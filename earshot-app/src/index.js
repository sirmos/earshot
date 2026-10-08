import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { RobotSystem } from './robot.js';
import { EarshotSystem } from './earshot.js';
import { RoomSystem } from './room.js';
import { GalaSystem } from './gala.js';
import { TitleSystem } from './title.js';
World.create(document.getElementById('scene-container'), projectOptions).then((world) => {
    world.registerSystem(RobotSystem);
    world.registerSystem(PanelSystem);
    world.registerSystem(EarshotSystem);
    world.registerSystem(RoomSystem);
    world.registerSystem(GalaSystem);
    world.registerSystem(TitleSystem);
});