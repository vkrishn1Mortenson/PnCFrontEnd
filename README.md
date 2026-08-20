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

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
