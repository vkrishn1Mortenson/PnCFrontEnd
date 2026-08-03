import msal
import requests

# Create a custom web session that ignores SSL errors
custom_session = requests.Session()
custom_session.verify = False  # Tells Python to ignore the self-signed certificate

# Suppress the ugly warning messages in the terminal
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TENANT_ID = "e36ecb8a-b131-4d08-9307-3b1b3d68c6bd" 
AUTHORITY = f"https://microsoft.com/{TENANT_ID}"
SCOPES = ["https://windows.net"]
CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46" 

# Pass the custom session into MSAL using http_client
app = msal.PublicClientApplication(
    CLIENT_ID,
    authority=AUTHORITY,
    http_client=custom_session  # <--- This bypasses the SSL error
)

print("Triggering the browser login pop-up...")
result = app.acquire_token_interactive(scopes=SCOPES)

if "access_token" in result:
    print("\n✅ Success! The login pop-up worked perfectly.")
else:
    print(f"\n❌ Login failed: {result.get('error_description')}")
