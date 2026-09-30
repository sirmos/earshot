import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { RobotSystem } from './robot.js';
import { EarshotSystem } from './earshot.js';
World.create(document.getElementById('scene-container'), projectOptions).then((world) => {
    world.registerSystem(RobotSystem);
    world.registerSystem(PanelSystem);
    world.registerSystem(EarshotSystem);
});
