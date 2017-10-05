### REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries. This program only prepares submissions to NDA as csv formatted spreadsheets.

![Web Interface](/img/screenshot.png "Application Interface")

A tagging system is used to code items that should not be exported, or items that should have at most 60 or 200 characters (30 is used as default).

```
npm start
./node_modules/.bin/build
./dist/redcap2ndar-1.0.0-x86_64.AppImage
```

### Setup

```
npm install request async electron jquery electron-store
```

Install electron-builder on your system - not inside the application and run 
```
electron-builder build
```
