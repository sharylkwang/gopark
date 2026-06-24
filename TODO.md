1. I think need rework Geofence, it was applied to only parkaholic, but shld be applied to all as a pipeline preprocessing layer to handle new carpark or any new sources of data.
2. Seeding of Data, currently its done by cached data/data.json, for pure speed on deployment env, but causes many merge conflicts between branches. Need think, maybe during CICD? or Deployment we have a Job that maintains a constant DB on the Deployment env (but need figure out how to handle for schema changes). Maybe a seperate branch for the DB?


## Main Features
- [ ] 3D Google Map API
- [ ] Carpark Usage Recording
- [ ] Fix some of the Availability bugs, like not showing up etc
- [ ] Fix UI Bugs