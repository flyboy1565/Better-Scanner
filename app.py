import streamlit as st
import os
import subprocess
from PIL import Image, ImageOps
import cv2
import numpy as np
import datetime
import time
from streamlit_image_coordinates import streamlit_image_coordinates

# --- CONFIGURATION & DEVICE REGISTRY ---
DEVICES = {
    "Epson WF-4720 (WorkForce)": "airscan:w1:Epson WF-4720 (WorkForce)",
    "Epson ET-2800 (EcoTank)": "airscan:w2:Epson ET-2800 (EcoTank)"
}

RAW_SCAN_PATH = "raw_scan_temp.jpg"
TARGET_DIR = "/mnt/c/Users/flybo/OneDrive/Pictures/Scanner Images ( Nana&Mom )"

st.set_page_config(page_title="WSL Network Batch Scanner", page_icon="🐧", layout="wide")

# Initialize Session State
if "scanned_photos" not in st.session_state:
    st.session_state.scanned_photos = []
if "full_raw_scan" not in st.session_state:
    st.session_state.full_raw_scan = None
if "photo_names" not in st.session_state:
    st.session_state.photo_names = {}
if "photo_saves" not in st.session_state:
    st.session_state.photo_saves = {}
if "last_error" not in st.session_state:
    st.session_state.last_error = None
if "workspace_version" not in st.session_state:
    st.session_state.workspace_version = 0
if "manual_boxes" not in st.session_state:
    st.session_state.manual_boxes = []  # Holds tuples of ((x1, y1), (x2, y2))
if "current_click_start" not in st.session_state:
    st.session_state.current_click_start = None

# Ensure target Windows directory exists via WSL mount
if not os.path.exists(TARGET_DIR):
    try:
        os.makedirs(TARGET_DIR, exist_ok=True)
    except Exception:
        TARGET_DIR = "."

# --- CORE LINUX SANE FUNCTIONS ---

def trigger_sane_scan(device_uri, source_input="Platen", status_box=None):
    st.session_state.last_error = None  
    sane_source = "Flatbed" if source_input == "Platen" else "ADF"
    
    cmd = [
        "scanimage",
        "-d", device_uri,
        f"--source={sane_source}",
        "--format=jpeg",
        "--resolution=600",
        f"--output-file={RAW_SCAN_PATH}"
    ]
    
    max_retries = 6
    retry_delay = 4.0  
    
    for attempt in range(1, max_retries + 1):
        try:
            if attempt == 1:
                status_box.update(label="Connecting to scanner hardware via SANE...", state="running")
            else:
                status_box.update(
                    label=f"⚠️ Connection dropped. Attempting reconnect {attempt} of {max_retries}...", 
                    state="running"
                )
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return os.path.exists(RAW_SCAN_PATH) and os.path.getsize(RAW_SCAN_PATH) > 0
            
        except subprocess.CalledProcessError as e:
            st.session_state.last_error = {
                "command": " ".join(e.cmd),
                "exit_code": e.returncode,
                "stderr": e.stderr if e.stderr else "No descriptive error stream returned by SANE backend."
            }
            if attempt < max_retries:
                time.sleep(retry_delay)
            else:
                return False
        except Exception as e:
            st.session_state.last_error = {
                "command": "scanimage",
                "exit_code": "Unknown",
                "stderr": str(e)
            }
            if attempt < max_retries:
                time.sleep(retry_delay)
            else:
                return False
    return False

def split_multi_photo_scan(image_path):
    img = cv2.imread(image_path)
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
                    cropped = img[new_y:new_y+new_h, new_x:new_x+new_w]
                    cropped_rgb = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)
                    pil_img = Image.fromarray(cropped_rgb)
                    pil_img = pil_img.rotate(180, expand=True)
                    extracted_images.append(pil_img)
                
    return list(reversed(extracted_images))

# --- UI DISPLAY DESK ---

st.title("🐧 WSL Multi-Photo Batch Scanner")
st.subheader("Individually Name, Toggle, or Batch-Save Photos Directly to OneDrive")
st.write("---")

scan_mode = st.radio(
    "Work Mode", 
    ["⚡ Auto-Detect (Multi-Photo Slicer)", "📐 Manual Click-to-Crop Canvas"], 
    horizontal=True
)

col1, col2 = st.columns([1, 2])
v_id = st.session_state.workspace_version

with col1:
    st.header("Control Panel")
    selected_device_name = st.selectbox("Target Scanner Hardware", list(DEVICES.keys()))
    selected_device_uri = DEVICES[selected_device_name]
    
    scan_source = st.radio("Paper Feed Source", ["Platen (Flatbed Glass)", "Adf (Auto Feeder Stack)"])
    source_val = "Platen" if "Platen" in scan_source else "Adf"
    st.write("---")
    
    if st.button("🚀 Trigger Batch Scan", type="primary", width="stretch"):
        st.session_state.manual_boxes = []
        st.session_state.current_click_start = None
        
        with st.status("Initializing scan pipeline...", expanded=True) as status:
            success = trigger_sane_scan(device_uri=selected_device_uri, source_input=source_val, status_box=status)
            
            if success:
                status.update(label="Loading flatbed image buffer...", state="running")
                raw_pil = Image.open(RAW_SCAN_PATH)
                st.session_state.full_raw_scan = raw_pil
                
                if "Auto-Detect" in scan_mode:
                    found_photos = split_multi_photo_scan(RAW_SCAN_PATH)
                    st.session_state.scanned_photos = found_photos
                    st.session_state.photo_names = {i: "" for i in range(len(found_photos))}
                    st.session_state.photo_saves = {i: True for i in range(len(found_photos))}
                    st.toast(f"Successfully isolated {len(found_photos)} distinct photos!", icon="📸")
                else:
                    st.session_state.scanned_photos = []
                    st.toast("Full flatbed projection ready for manual clicking!", icon="📐")
                
                status.update(label="Scan completed successfully!", state="complete", expanded=False)
            else:
                status.update(label="Scan driver pipeline failed.", state="error", expanded=True)

    # Export Engine
    if st.session_state.scanned_photos:
        st.write("---")
        st.write("### Commit Workspace to Windows")
        file_format = st.selectbox("Format Type", ["JPEG", "PNG"])
        out_ext = file_format.lower()
        
        active_save_count = sum(1 for v in st.session_state.photo_saves.values() if v)
        st.metric("Photos Marked for Export", f"{active_save_count} / {len(st.session_state.scanned_photos)}")
        
        if st.button("💾 Save Selected Photos", type="secondary", width="stretch"):
            if active_save_count == 0:
                st.warning("No photos are marked for saving.")
            else:
                saved_count = 0
                now = datetime.datetime.now()
                timestamp_base = now.strftime("img%Y%m%d_%H%M%S%f")[:-4]
                
                for i, photo in enumerate(st.session_state.scanned_photos):
                    if not st.session_state.photo_saves.get(i, True):
                        continue
                        
                    custom_name = st.session_state.photo_names.get(i, "").strip()
                    filename = f"{custom_name}.{out_ext}" if custom_name else f"{timestamp_base}_{i+1}.{out_ext}"
                    full_save_path = os.path.join(TARGET_DIR, filename)
                    
                    if file_format == "JPEG" and photo.mode == "RGBA":
                        photo = photo.convert("RGB")
                        
                    photo.save(full_save_path, format=file_format)
                    saved_count += 1
                
                st.toast(f"Successfully synced {saved_count} items straight to OneDrive!", icon="✅")
                st.session_state.scanned_photos = []
                st.session_state.manual_boxes = []
                st.session_state.photo_names = {}
                st.session_state.photo_saves = {}
                st.session_state.workspace_version += 1
                st.rerun()

        if st.button("🗑️ Clear Current Workspace", type="primary", width="stretch"):
            st.session_state.scanned_photos = []
            st.session_state.manual_boxes = []
            st.session_state.current_click_start = None
            st.session_state.photo_names = {}
            st.session_state.photo_saves = {}
            st.session_state.workspace_version += 1
            st.rerun()

with col2:
    if "Manual Click-to-Crop" in scan_mode:
        st.header("📐 Click Corner Coordinates")
        if st.session_state.full_raw_scan:
            # 1. Provide instructions based on click step
            if st.session_state.current_click_start is None:
                st.info("👉 **Step 1:** Click on the **Top-Left** corner of the object you want to save.")
            else:
                st.warning("👉 **Step 2:** Click on the **Bottom-Right** corner to finalize the crop area.")

            # 2. Draw a quick markup layout with OpenCV for the preview glass
            display_width = 750
            orig_w, orig_h = st.session_state.full_raw_scan.size
            scale_ratio = display_width / orig_w
            display_height = int(orig_h * scale_ratio)
            
            # Create a visual map with boxes layered over it
            img_cv = cv2.cvtColor(np.array(st.session_state.full_raw_scan), cv2.COLOR_RGB2BGR)
            
            # Draw existing finalized bounding boxes
            for box in st.session_state.manual_boxes:
                cv2.rectangle(img_cv, box[0], box[1], (0, 165, 255), 4)
                
            # Draw temporary starting dot if step 1 is locked in
            if st.session_state.current_click_start:
                cv2.circle(img_cv, st.session_state.current_click_start, 10, (255, 0, 0), -1)
                
            annotated_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
            
            # 3. Capture Click Event
            value = streamlit_image_coordinates(
                annotated_pil,
                width=display_width,
                key=f"coords_canvas_v{v_id}_{len(st.session_state.manual_boxes)}"
            )
            
            if value is not None:
                # Upscale the click coordinates back to native 600 DPI density
                click_x = int(value["x"] / scale_ratio)
                click_y = int(value["y"] / scale_ratio)
                
                if st.session_state.current_click_start is None:
                    # Set top-left anchor point
                    st.session_state.current_click_start = (click_x, click_y)
                    st.rerun()
                else:
                    # Finalize bottom-right anchor point
                    x1, y1 = st.session_state.current_click_start
                    x2, y2 = click_x, click_y
                    
                    # Ensure coordinates are properly ordered regardless of drawing direction
                    real_x1, real_x2 = min(x1, x2), max(x1, x2)
                    real_y1, real_y2 = min(y1, y2), max(y1, y2)
                    
                    if (real_x2 - real_x1) > 15 and (real_y2 - real_y1) > 15:
                        st.session_state.manual_boxes.append(((real_x1, real_y1), (real_x2, real_y2)))
                        
                        # Instantly cut and append the cropped item to the workspace list
                        cropped_item = st.session_state.full_raw_scan.crop((real_x1, real_y1, real_x2, real_y2))
                        # Base scan adjustment flip
                        cropped_item = cropped_item.rotate(180, expand=True)
                        st.session_state.scanned_photos.append(cropped_item)
                        
                    st.session_state.current_click_start = None
                    st.rerun()
        else:
            st.info("Flatbed glass map empty. Trigger a scan above to visualize the layout tray.")

    # --- SHARED INTERACTIVE GALLERY DECK ---
    if st.session_state.scanned_photos:
        st.write("---")
        st.write("### 🖼️ Active Extracts & Orientation Panel")
        preview_ts = datetime.datetime.now().strftime("img%Y%m%d_%H%M%S")
        
        for idx, photo in enumerate(st.session_state.scanned_photos):
            is_active = st.session_state.photo_saves.get(idx, True)
            
            with st.container(border=True):
                c_img, c_meta = st.columns([1, 1])
                with c_img:
                    st.image(photo, use_container_width=True)
                
                with c_meta:
                    st.write(f"**Extract #{idx+1}** ({photo.width}x{photo.height}px)")
                    
                    # Active Toggle Selection
                    st.session_state.photo_saves[idx] = st.checkbox("Include in Batch Save", value=is_active, key=f"save_chk_{idx}_v{v_id}")
                    
                    # Naming Override Engine
                    if idx not in st.session_state.photo_names:
                        st.session_state.photo_names[idx] = ""
                    st.session_state.photo_names[idx] = st.text_input(
                        "File Name Override", 
                        value=st.session_state.photo_names[idx],
                        placeholder=f"{preview_ts}_{idx+1}", 
                        key=f"name_field_{idx}_v{v_id}"
                    )
                    
                    # Transform Controls Registry
                    st.markdown("**Image Orientations:**")
                    r_col1, r_col2, r_col3, r_col4 = st.columns(4)
                    
                    with r_col1:
                        if st.button("🔄 Left 90°", key=f"l90_{idx}_v{v_id}"):
                            st.session_state.scanned_photos[idx] = photo.rotate(90, expand=True)
                            st.rerun()
                    with r_col2:
                        if st.button("🔄 Right 90°", key=f"r90_{idx}_v{v_id}"):
                            st.session_state.scanned_photos[idx] = photo.rotate(-90, expand=True)
                            st.rerun()
                    with r_col3:
                        if st.button("↔️ Flip H", key=f"fliph_{idx}_v{v_id}"):
                            st.session_state.scanned_photos[idx] = ImageOps.mirror(photo)
                            st.rerun()
                    with r_col4:
                        if st.button("↕️ Flip V", key=f"flipv_{idx}_v{v_id}"):
                            st.session_state.scanned_photos[idx] = ImageOps.flip(photo)
                            st.rerun()
                    
                    # Delete Extraction Target Box
                    if st.button("🗑️ Delete Selection", key=f"del_{idx}_v{v_id}", type="primary"):
                        st.session_state.scanned_photos.pop(idx)
                        if "Manual Click-to-Crop" in scan_mode and idx < len(st.session_state.manual_boxes):
                            st.session_state.manual_boxes.pop(idx)
                        st.session_state.workspace_version += 1
                        st.rerun()