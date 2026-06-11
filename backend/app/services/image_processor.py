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
