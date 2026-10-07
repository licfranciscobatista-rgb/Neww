import hashlib
import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as apk:
    prefix = 'assets/public/'
    manifest = json.loads(apk.read(prefix + 'release-manifest.json'))
    identity = json.loads(apk.read(prefix + 'build-info.json'))
    assert identity['commit'] == manifest['commit'], 'APK build identity mismatch'
    for name, expected in manifest['files'].items():
        actual = hashlib.sha256(apk.read(prefix + name)).hexdigest()
        assert actual == expected, f'APK asset mismatch: {name}'
    print(f"PASS: APK {manifest['commit']} contains all {len(manifest['files'])} verified web files.")
