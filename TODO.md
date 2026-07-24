## Main Features





Sk
- [ ] Mobile compatibility (responsive layout, touch interactions)
- [ ] Fix UI Bugs

Mt
- [ ] Add https://eservice.ura.gov.sg/maps/api/
- [ ] Fix motorcycle availability glitch in detail panel
- [ ] Fix some of the Availability bugs, like not showing up etc

## Thinking Ideas
1. I think need rework Geofence, it was applied to only parkaholic, but shld be applied to all as a pipeline preprocessing layer to handle new carpark or any new sources of data.
2. Seeding of Data, currently its done by cached data/data.json, for pure speed on deployment env, but causes many merge conflicts between branches. Need think, maybe during CICD? or Deployment we have a Job that maintains a constant DB on the Deployment env (but need figure out how to handle for schema changes). Maybe a seperate branch for the DB?
3. Maybe a timeline like breakdown of the cost of the carpark, so people know how the cost is being calcualted
4. Maybe like AI-generated place descriptions (use LLM to describe carpark surroundings, nearby landmarks). Oh and maybe swap from GLM to Claude Wrapper for better Instructional based LLM Prompting. [Github](https://github.com/RichardAtCT/claude-code-openai-wrapper)
5. AI powered Carpark Usage Recording? Like how Maps does their plots of when it is busy? Maybe could integrate with the Carpark Planning for the area, so I know at the time of reaching which is usually busy and which is usually free so the carpark chosen can be the most optimal one. (Maybe can use the scraped data to train a model to predict carpark usage based on time of day, day of week, and other factors) (Or just go based on currently available data and build a algorithm)
6. Headline for traffic incidents? Broken Traffic Lights, Road Closures, Accidents, etc. (Maybe can use LLM to summarize the traffic incidents and show it on the map) or just a simple news bar that shows latest traffic incidents in Singapore.

## Performance Features
- [ ] 3D Map segmentation / optimization to improve performance (3D Maps cant run well, it uses 3D Gaussian Splatting and Neural Radiance Fields (NeRFs) for localized features like Immersive View and that is rather heavy on the GPU, so maybe we can segment the map into smaller chunks and only load the chunks that are needed for the current view, and unload the chunks that are not needed) (or maybe see if can tap into their gaussians and reduce the number of gaussians used for the 3D map, or maybe see if can use a different rendering technique that is less GPU intensive)