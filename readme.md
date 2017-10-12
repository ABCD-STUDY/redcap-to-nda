### REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries. This program does not upload data to NDA. It only prepares submissions as csv formatted spreadsheets for data dictionaries and for data.

![Web Interface](/img/screenshot.png "Application Interface")

In order to be able to connect to REDCap using REDCap's API this program requires the user to enter a REDCap data access token. These tokens need to be created by your REDCap administrator for the REDCap project. The program will not save this token but request it every time it is started. 
 
Some information required by NDA is not available in the REDCap data dictionary. There is no length specification for character strings in REDCap. This information is needed for NDA's data dictionary and has to be added to the exported NDA data dictionary. Additional information that this program needs to keep is an alternative name of the instrument that might be different from the name used in REDCap. The program will also allow the user to indicate items that should not be part of the export. This automatically includes REDCap's notes fields, but other items can also be removed from the export.

All of the information above have to be gathered during the export process. The program will store these additional information on your computer and it will try to load them every time it is restarted.

Small 'tag' buttons are displayed next to each item that can be used to code for item exclusion, or items string length (at most 60 or 200 characters, 30 characters is used as default). An edit icon is displayed next to the instrument name to allow the user to change the value of the string.

### Build

See if the provided executables in the dist/ directory are sufficient for you. Otherwise build the program by installing nodejs and git. Clone this repositories in a folder on your system and:

```
npm install request async electron jquery electron-store
npm start
```

Install electron-builder on your system - not inside the application and run 
```
electron-builder build
ls -la ./dist/redcap2ndar-1.0.0-x86_64.AppImage
```
