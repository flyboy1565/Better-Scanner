import cv2
import numpy as np
from PIL import Image, ImageOps
from typing import List, Tuple


class ImageProcessor:
    """Handles image processing: auto-detection, cropping, transformations"""

    @staticmethod
    def split_multi_photo_scan(image_path: str) -> List[Image.Image]:
        """
        Auto-detect multiple photos in a scan and split them.
        Based on contour detection and area analysis.
        """
        img = cv2.imread(image_path)
        if img is None:
            return []

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (11, 11), 0)
        _, thresh = cv2.threshold(blurred, 225, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        extracted_images = []
        shave_pixels = 24

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 32000:
                x, y, w, h = cv2.boundingRect(cnt)
                if w > 80 and h > 80:
                    new_x = max(0, x + shave_pixels)
                    new_y = max(0, y + shave_pixels)
                    new_w = max(1, w - (shave_pixels * 2))
                    new_h = max(1, h - (shave_pixels * 2))

                    if new_w > 10 and new_h > 10:
                        cropped = img[new_y : new_y + new_h, new_x : new_x + new_w]
                        cropped_rgb = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)
                        pil_img = Image.fromarray(cropped_rgb)
                        pil_img = pil_img.rotate(180, expand=True)
                        extracted_images.append(pil_img)

        return list(reversed(extracted_images))

    @staticmethod
    def crop_image(image: Image.Image, x1: int, y1: int, x2: int, y2: int) -> Image.Image:
        """
        Crop image to specified coordinates.
        Ensures coordinates are properly ordered.
        """
        real_x1, real_x2 = min(x1, x2), max(x1, x2)
        real_y1, real_y2 = min(y1, y2), max(y1, y2)

        cropped = image.crop((real_x1, real_y1, real_x2, real_y2))
        cropped = cropped.rotate(180, expand=True)
        return cropped

    @staticmethod
    def rotate_image(image: Image.Image, rotation: int) -> Image.Image:
        """Rotate image by specified degrees (90, -90, 180)"""
        return image.rotate(rotation, expand=True)

    @staticmethod
    def flip_horizontal(image: Image.Image) -> Image.Image:
        """Flip image horizontally"""
        return ImageOps.mirror(image)

    @staticmethod
    def flip_vertical(image: Image.Image) -> Image.Image:
        """Flip image vertically"""
        return ImageOps.flip(image)

    @staticmethod
    def apply_transform(
        image: Image.Image, rotation: int = 0, flip_h: bool = False, flip_v: bool = False
    ) -> Image.Image:
        """Apply multiple transformations to an image"""
        if rotation != 0:
            image = ImageProcessor.rotate_image(image, rotation)
        if flip_h:
            image = ImageProcessor.flip_horizontal(image)
        if flip_v:
            image = ImageProcessor.flip_vertical(image)
        return image

    @staticmethod
    def fix_photo(image: Image.Image, mode: str = "auto") -> Image.Image:
        """
        Apply classical (non-AI) automatic restoration to a photo.

        Modes:
          - "auto": full pipeline (scratch repair + sharpen + color correction)
          - "scratch": remove small scratches/dust via inpainting
          - "enhance": denoise + sharpen detail
          - "color": correct faded color casts and boost contrast
        """
        image = ImageProcessor._fix_steps(image, mode)
        return image

    @staticmethod
    def _fix_steps(image: Image.Image, mode: str) -> Image.Image:
        """Helper that runs whichever sub-fixes the mode requests."""
        do_scratch = mode in ("auto", "scratch")
        do_enhance = mode in ("auto", "enhance")
        do_color = mode in ("auto", "color")

        img = image.convert("RGB")
        bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        if do_scratch:
            bgr = ImageProcessor._remove_scratches(bgr)

        if do_color:
            bgr = ImageProcessor._color_correct(bgr)

        if do_enhance:
            bgr = ImageProcessor._enhance_detail(bgr)

        pil = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))

        # Re-apply original alpha if the source had transparency (e.g. PNG crops)
        if image.mode == "RGBA":
            pil = pil.convert("RGBA")
            pil.putalpha(image.getchannel("A"))
        elif image.mode == "P":
            pil = pil.convert("RGB")

        return pil

    @staticmethod
    def _color_correct(bgr: np.ndarray) -> np.ndarray:
        """Gray-world white balance plus CLAHE contrast boost on the L channel."""
        b, g, r = cv2.split(bgr)

        # Gray-world white balance: scale channels so their means are equal.
        means = [float(ch.mean()) for ch in (b, g, r)]
        mean_all = sum(means) / 3.0 if means else 128.0
        scale_b = mean_all / means[0] if means[0] > 0 else 1.0
        scale_g = mean_all / means[1] if means[1] > 0 else 1.0
        scale_r = mean_all / means[2] if means[2] > 0 else 1.0

        b = np.clip(b.astype(np.float32) * scale_b, 0, 255).astype(np.uint8)
        g = np.clip(g.astype(np.float32) * scale_g, 0, 255).astype(np.uint8)
        r = np.clip(r.astype(np.float32) * scale_r, 0, 255).astype(np.uint8)

        balanced = cv2.merge([b, g, r])

        # CLAHE on the L channel of LAB to lift faded contrast without over-boosting color.
        lab = cv2.cvtColor(balanced, cv2.COLOR_BGR2LAB)
        l, a, ch_b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, ch_b])

        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    @staticmethod
    def _enhance_detail(bgr: np.ndarray) -> np.ndarray:
        """Gently smooth noise, then apply an unsharp mask for detail."""
        smoothed = cv2.bilateralFilter(bgr, d=5, sigmaColor=24, sigmaSpace=24)

        blurred = cv2.GaussianBlur(smoothed, (0, 0), 1.4)
        unsharp = cv2.addWeighted(smoothed, 1.5, blurred, -0.5, 0)

        return unsharp

    @staticmethod
    def _remove_scratches(bgr: np.ndarray) -> np.ndarray:
        """
        Detect thin bright/dark scratch lines via morphological top-hat and
        black-hat, then inpaint them with Telea's method.
        """
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        top_hat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
        black_hat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)

        combined = cv2.max(top_hat, black_hat)

        _, mask = cv2.threshold(combined, 18, 255, cv2.THRESH_BINARY)

        # Slightly dilate the scratches so inpainting covers the damaged edge.
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.dilate(mask, dilate_kernel, iterations=1)

        if cv2.countNonZero(mask) == 0:
            return bgr

        return cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
