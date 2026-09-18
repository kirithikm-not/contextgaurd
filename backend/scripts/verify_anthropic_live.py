"""
Live smoke test script for Anthropic Claude API integration.
Validates the configured ANTHROPIC_API_KEY and ANTHROPIC_MODEL string against docs.anthropic.com.
"""
import os
import sys
import httpx
from dotenv import load_dotenv

# Load backend/.env
load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022").strip()

print(f"Testing Anthropic API configuration:")
print(f"Target Model ID: {model}")

if not api_key:
    print("\n[INFO] ANTHROPIC_API_KEY is not set in backend/.env.")
    print("ContextGuard is currently running in resilient MOCK_AGENT mode.")
    print("To test with a live cloud key, add your key to backend/.env:")
    print("  ANTHROPIC_API_KEY=sk-ant-api03-...")
    print("  USE_MOCK_AGENT=false")
    sys.exit(0)

url = "https://api.anthropic.com/v1/messages"
headers = {
    "x-api-key": api_key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
}
payload = {
    "model": model,
    "max_tokens": 50,
    "messages": [
        {"role": "user", "content": "ContextGuard Zero-Trust ping test. Respond with 'PONG'."}
    ],
    "temperature": 0.0,
}

try:
    with httpx.Client(timeout=10.0) as client:
        response = client.post(url, headers=headers, json=payload)
        print(f"Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            content = data["content"][0]["text"].strip()
            print(f"API Response: {content}")
            print(f"[SUCCESS] Model '{model}' resolved and authenticated successfully!")
        else:
            print(f"[ERROR] Anthropic API returned error:")
            print(response.text)
except Exception as e:
    print(f"[EXCEPTION] Network or connection error: {e}")
