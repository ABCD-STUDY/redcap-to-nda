## REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries. This program does not upload data to NDA. It only prepares submissions as csv formatted spreadsheets for data dictionaries and for data.

![Web Interface](/img/screenshot.png "Application Interface")

In order to be able to connect to REDCap using REDCap's API this program requires the user to enter a REDCap data access token. These tokens need to be created by your REDCap administrator for the REDCap project. The program will not save this token but request it every time it is started. 
 
Some information required by NDA is not available in the REDCap data dictionary. There is no length specification for character strings in REDCap. This information is needed for NDA's data dictionary and has to be added to the exported NDA data dictionary. Additional information that this program needs to keep is an alternative name of the instrument that might be different from the name used in REDCap. The program will also allow the user to indicate items that should not be part of the export. This automatically includes REDCap's notes fields, but other items can also be removed from the export.

All of the information above have to be gathered during the export process. The program will store these additional information on your computer and it will load them every time it is restarted.

Small 'tag' buttons are displayed next to each item that can be used to code for item exclusion, or items string length (at most 60 or 200 characters, 30 characters is used as default). An edit icon is displayed next to the instrument name to allow the user to change the value of the string that identifies the instrument. This string is exported as the first line of the generated comma-separated values (CSV) file.

### Restrictions

REDCap's data dictionaries are used for two purposes. Foremost they are used to code for the instruments used during data collection. These instruments contain the minute details in which questions are rendered towards the participant. They are order-dependent as sections of instructions can be interspersed with compact response matrices referencing higher-level instructions. They can also contain pictures or videos especially suited to convey levels of pain or stress. The primary focus of these instruments is to be self-sufficient and complete, and to allow for a controlled administration of an instrument across different cohorts, instances of REDCap and projects.

Secondarily, REDCap's data dictionaries are also used to represent derived scores. In this capacity the instruments function as a means to store more abstract concepts such as intelligence scores. The reader of these instruments is a researcher and they are usually filled by data using some kind of auto-scoring framework (see ABCD's auto-scoring framework). In this capacity derived scores are relatively independent from each other and can be used in isolation for example in statistical models. Therefore the order of items in these instruments is also arbitrary.

The NMIH data archive repository focuses on the secondary purpose of sharing derived scores. Formatting instructions such as html are not encouraged as they cannot be rendered and there is no hierachical representation of inter-dependend items or item ordering in an instrument. There is also only limited support for multi-language versions of instruments (utf-8). These limitations prevent a complete representation of all informations encoded into the REDCap instrument in the generated NDA data dictionary.

Usually there are two representations for the value of choice items. One is a numerical value such as "1" or "0", and the other is a verbal meaning of those values such as the labels "Yes" and "No". REDCap allows exports of its data in either of these two representations. As mappings between the two representations are part of the data dictionary "1 = Yes; 0 = No" NDA preferrs to represent data in the more compact numerical format. 

### Build

See if the provided executables in the dist/ directory are sufficient for you. Otherwise build the program by installing nodejs and git. Clone this repositories in a folder on your system and:

```
npm install request async electron jquery electron-store striptags
npm start
```

Install electron-builder on your system - not inside the application and run 
```
electron-builder build
ls -la ./dist/redcap2ndar-1.0.0-x86_64.AppImage
```
