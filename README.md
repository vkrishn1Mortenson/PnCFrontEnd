# How to navigate

There are 3 branches in this repo: master, Excel_Scripts,Sharepoint_Metadata_extractor. They all have distinct purposes.
## master

Contains the entire frontend ui for the P&C Automation Project 

To build do the following: 

```bash
git clone https://github.com/vkrishn1Mortenson/PnCFrontEnd.git
```
Spawn 2 new terminals and run the following commands seperately
```bash
cd PnCFrontEnd
npm install
```
```bash
cd backend
pip install -m requirements.txt
```

## Sharepoint metadata extractor

Simply download the py file and run it from a terminal or use VSCode. It will prompt you to login via browser when run. For terminal:
```bash
python3 "<path to where the py file is>/Metadata_Update.py"
```
