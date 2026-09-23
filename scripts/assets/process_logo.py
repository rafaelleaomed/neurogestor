import sys
from PIL import Image

def process_logo(input_path, output_path):
    print(f"Opening {input_path}")
    try:
        img = Image.open(input_path).convert("RGBA")
    except Exception as e:
        print(f"Error opening image: {e}")
        return

    width, height = img.size
    print(f"Original size: {width}x{height}")

    # The user wants to delete the text below it, leaving only the brain icon.
    # Usually the icon is in the upper part (maybe top 70%).
    # Let's crop the bottom 30% first.
    crop_height = int(height * 0.70)
    print(f"Cropping to {width}x{crop_height}")
    img_cropped = img.crop((0, 0, width, crop_height))

    # Now we need to remove the black/very dark background.
    # The logo has a black background `#000000` or close to it.
    datas = img_cropped.getdata()
    new_data = []
    
    # We want a very smooth thresholding to not cut harsh edges.
    for item in datas:
        # item is (R, G, B, A)
        r, g, b, a = item
        
        # Calculate luminance
        lum = (0.299*r + 0.587*g + 0.114*b)
        
        # If it's very dark (almost black), make it transparent
        # A simple hard threshold first
        if r < 20 and g < 20 and b < 20:
            new_data.append((0, 0, 0, 0))
        else:
            # Maybe some antialiasing/blending for edges
            # If luminance is very low, reduce alpha
            if lum < 40:
                alpha = int((lum / 40.0) * a)
                new_data.append((r, g, b, alpha))
            else:
                new_data.append(item)

    img_cropped.putdata(new_data)
    
    # Let's crop empty transparent space to tightly fit the icon.
    bbox = img_cropped.getbbox()
    if bbox:
        img_cropped = img_cropped.crop(bbox)
        print(f"Tightly cropped to: {img_cropped.size}")

    img_cropped.save(output_path, "PNG")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    process_logo("public/logo.png", "public/logo_transparent.png")
