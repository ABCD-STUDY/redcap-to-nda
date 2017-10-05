### REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries. This program does not upload data to NDA. It only prepares submissions as csv formatted spreadsheets for data dictionaries and for data.

![Web Interface](/img/screenshot.png "Application Interface")

In order to be able to connect to REDCap using REDCap's API this program requires the user to enter a REDCap data access token. These tokens need to be created by your REDCap administrator for the REDCap project. The program will not save this token but request it every time it is started. 
 
Some information required by NDA is not available in the REDCap data dictionary. For example the length of a character string is not available from REDCap. Because of this the program will store the additional information on your computer to make them avilable after a program restart. This also includes informations on the exclusion of specific items. 

Small 'tag' buttons are displayed next to each item that can be used to code for item exclusion, or items string length (at most 60 or 200 characters, 30 characters is used as default).


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
