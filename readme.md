## REDCap to NDA

Export REDCap's data dictionaries to NIMH National Data Archive data dictionaries. This program does not upload data to NDA. It only prepares submissions as csv formatted spreadsheets for data dictionary spreadsheets and for data spreadsheets.

![Web Interface](/img/screenshot.png "Application Interface")

In order to be able to connect to REDCap using REDCap's API this program requires the user to enter a REDCap data access token. These tokens need to be created by your REDCap administrator for your REDCap project. The program will not save this token but request it every time it is started. 
 
Some information required by NDA is not available in the REDCap data dictionary. There is no length specification for character strings in REDCap. This information is needed for NDA's data dictionary and has to be added to the exported NDA data dictionary. Additional information that this program needs to keep is an alternative name of the instrument that might be different from the name used in REDCap. The program will also allow the user to indicate items that should not be part of the export. This automatically includes REDCap's notes fields, but other items can also be removed from the export. This is implemented by 'tag' buttons that are displayed next to each item. If enabled they code for item exclusion, or specific item string length (at most 60 or 200 characters, 30 characters are used as default value). An edit icon is displayed next to the instrument name to allow the user to change the name that identifies the instrument. This name is exported as the first line of the generated comma-separated values (CSV) file. Date fields in any format can be identified and converted from their default string representation to NDA's date field format using a user specified parse string. REDCap checkboxes (coded with "___" and a number) always contain the value "0" if they are not set. As a special tag 'X' allows these variables to be set to empty instead of "0" if none of the checkboxes have been selected by the participant. This would indicate that the checkbox fields have not been answered. Another tag button 'N' can be used to indicate for an item that its branching logic (conditional logic) should be copied to the notes section of the NDA data dictionary. This will prevent an active check of the conditional logic by NDA while keeping some level of documentation. As this change information is not part of the data dictionary but generated during data conversion to NDA's data format the program creates a local key-value pair store. 

All of the information above are gathered by an interactive process that starts with loading the existing instruments for a given event. Each item in a highlighted instrument is first displayed and can afterwards be checked for expected errors during export. At any point the user can add information to an item to resolve simple errors like length restrictions of text fields or, the user can export the data dictionary and the data spreadsheets which will apply the current set of changes.


### Restrictions

The scope of measures or items in REDCap is by project. This means that an item name has to be unique across all the instruments of that project. On NDA the item scope is only the instrument itself. It it possible to create the same item in several instruments. Because of this conditional logic in REDCap can reference items in other instruments but on NDA this is not possible.

REDCap's data dictionaries are used for two purposes. Foremost they are used to code for the instruments used during data collection. These instruments contain the minute details in which questions are rendered towards the participant. They are order-dependent as sections of instructions can be interspersed with compact response matrices referencing higher-level instructions. They can also contain pictures or videos especially suited to convey levels of pain or stress. The primary focus of these instruments is to be self-sufficient and complete, and to allow for a controlled administration of an instrument across different cohorts, instances of REDCap and projects.

Secondarily, REDCap's data dictionaries are also used to represent derived scores. In this capacity the instruments function as a means to store more abstract concepts such as intelligence scores. The reader of these instruments is a researcher and data is usually entered by some kind of auto-scoring framework (see ABCD's auto-scoring framework). In this capacity derived scores are relatively independent from each other and can be used in isolation. Therefore the order of items in these domain instruments is arbitrary.

The NMIH data archive repository focuses on the secondary purpose of sharing derived scores. Formatting instructions such as html are not encouraged as they cannot be rendered and there is no hierachical representation of inter-dependend items or item ordering in an instrument. There is also only limited support for multi-language versions of instruments (utf-8). These limitations prevent a complete representation of all informations encoded into the REDCap instrument in the generated NDA data dictionary.

Usually there are two representations for the value of choice items. One is a numerical representation, such as "1" or "0", the other is a verbal meaning of those values such as the labels "Yes" and "No". In a statistical sense these two representations denote ranked values and categorical values. The above example for "Yes/No" a categorical representation makes sense. The ranked "1" "0" representation implies the more complex meaning of an order that might be incompatible with the intention of the measure as order implies preference of one answer over the other regardless of user input. REDCap allows exports of its data in either of these two representations for the whole instrument. As mappings between the two representations are part of the data dictionary "1 = Yes; 0 = No" NDA and others prefer to represent data in the more compact numerical format. In the future it might be useful to add variable types such as "ranked", "nominal", or "category" to indicate the precise measing of choice fields.

Branching logic in REDCap and conditional logic in NDA instruments are mostly compatible after some trivial changes in syntax. The limitation on NDA is that instrument are supposed to be self-contained. Branching logic referencing items in other instruments are possible in REDCap, in NDA's version of the data dictionaries they are not possible and will result in a data verification failure during data upload. We opted to remove the conditional logic and move it into the freeform notes section of NDA's data dictionaries. 

### Build

See if the provided executables in the dist/ directory are sufficient for you. Otherwise build the program by installing nodejs and git. Clone this repositories in a folder on your system and:

```
npm install request async electron jquery electron-store striptags moment
npm start
```

Install electron-builder on your system - not inside the application and run 
```
electron-builder build
ls -la ./dist/redcap2ndar-1.0.0-x86_64.AppImage
```
