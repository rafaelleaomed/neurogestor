import os
import sys
from google import genai
from google.genai import types

def generate_logo():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        sys.exit(1)

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = (
            "A premium, modern logo for a healthcare management application called 'Neurogestor'. "
            "The design should be minimalist, sleek, and highly professional. "
            "It should incorporate a subtle nod to a brain or neural network intertwining with a shield, checkmark, or growth chart to signify management and trust. "
            "The color palette should feature deep medical blue and vibrant cyan or teal, conveying technology, care, and precision. "
            "The text 'Neurogestor' should be written in a clean, modern, sans-serif font below or beside the icon. "
            "Clean white background, high resolution, suitable for a modern web application dashboard."
        )

        print("Generating image...")
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE'],
                image_config=types.ImageConfig(
                    image_size="2K",
                    aspect_ratio="1:1"
                ),
            )
        )

        for part in response.parts:
            if part.inline_data:
                img = part.as_image()
                # Salvar a imagem original e também como PNG para uso web
                output_jpg = "public/neurogestor-logo.jpg"
                output_png = "public/neurogestor-logo.png"
                
                img.save(output_jpg)
                img.save(output_png, format="PNG")
                
                print(f"Logo gerada com sucesso e salva em {output_jpg} e {output_png}")
            elif part.text:
                print(part.text)

    except Exception as e:
        print(f"Error generating logo: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generate_logo()
