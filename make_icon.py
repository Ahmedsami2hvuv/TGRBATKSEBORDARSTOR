import sys
from PIL import Image

def make_monochrome(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # item is (R, G, B, A)
        if item[3] > 0: # If not completely transparent
            # Make it solid white with the same alpha
            new_data.append((255, 255, 255, item[3]))
        else:
            new_data.append((255, 255, 255, 0))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    make_monochrome(sys.argv[1], sys.argv[2])
