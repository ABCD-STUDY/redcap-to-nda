### REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries.

![Web Interface](/img/screenshot.png "Application Interface")

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
