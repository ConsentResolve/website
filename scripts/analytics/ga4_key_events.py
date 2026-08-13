import base64, json, subprocess, warnings
warnings.filterwarnings("ignore")
raw = subprocess.check_output(["security","find-generic-password","-s","cr-ga4_sa","-a","cr","-w"]).strip()
info = json.loads(base64.b64decode(raw))
from google.oauth2 import service_account
from google.analytics.admin import AnalyticsAdminServiceClient
from google.analytics.admin_v1alpha.types import KeyEvent
creds = service_account.Credentials.from_service_account_info(
    info, scopes=["https://www.googleapis.com/auth/analytics.edit"])
client = AnalyticsAdminServiceClient(credentials=creds)
PROP = "properties/524679634"

# 1) confirm measurement id via data streams
print("=== Data streams ===")
for s in client.list_data_streams(parent=PROP):
    wd = s.web_stream_data
    print(" ", s.display_name, "| measurement_id:", getattr(wd,"measurement_id",""))

# 2) existing key events
print("=== Existing key events ===")
existing = {k.event_name for k in client.list_key_events(parent=PROP)}
print(" ", existing or "(none)")

# 3) create the two we need
for name in ["book_meeting","generate_lead"]:
    if name in existing:
        print(f"  already a key event: {name}")
        continue
    ke = KeyEvent(event_name=name, counting_method=KeyEvent.CountingMethod.ONCE_PER_EVENT)
    client.create_key_event(parent=PROP, key_event=ke)
    print(f"  CREATED key event: {name}")

print("=== Final key events ===")
print(" ", {k.event_name for k in client.list_key_events(parent=PROP)})
