/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { AssetType, defineAssets } from '@iwsdk/core';
const publicAssetUrl = (filePath) => `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

// Only assets that ship inside this project. The starter's environment desk, plant and robot
// were downloaded from a CDN at startup, which could time out and stop the whole world loading.
export default defineAssets({
    'welcome-panel': {
        url: publicAssetUrl('ui/welcome.uikitml'),
        type: AssetType.UIKitML,
        name: 'Welcome Panel',
    },
    'webxr-banner': {
        url: publicAssetUrl('gltf/webxr-banner/banner.gltf'),
        type: AssetType.GLTF,
        name: 'WebXR Banner',
        priority: 'lazy',
    },
});