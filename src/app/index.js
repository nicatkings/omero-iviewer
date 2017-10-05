//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

// images
require('../../node_modules/bootstrap/fonts/glyphicons-halflings-regular.woff');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_777777_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_555555_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_ffffff_256x240.png');
require('../../node_modules/jquery-ui/themes/base/images/ui-icons_444444_256x240.png');


// js
import {inject} from 'aurelia-framework';
import Context from './context';
import Misc from '../utils/misc';
import Ui from '../utils/ui';
import {PLUGIN_PREFIX, SYNC_LOCK} from '../utils/constants';
import {IMAGE_VIEWER_RESIZE,
        REGIONS_STORE_SHAPES, REGIONS_STORED_SHAPES} from '../events/events';

/**
 * @classdesc
 *
 * The index view/page so to speak
 */
@inject(Context)
export class Index  {
    /**
     * the handle on the the resize function (from setTimeout)
     * @memberof Index
     * @type {number}
     */
    resizeHandle = null;

    /**
     * array of possible sync locks
     * @memberof Index
     * @type {Array.<Object>}
     */
    sync_locks = [
        SYNC_LOCK.Z,
        SYNC_LOCK.T,
        SYNC_LOCK.VIEW,
        SYNC_LOCK.CHANNELS
    ];

    /**
     * @constructor
     * @param {Context} context the application context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * Overridden aurelia lifecycle method:
     * fired when PAL (dom abstraction) is ready for use
     *
     * @memberof Index
     */
    attached() {
        // listen to resizing of the browser window
        let publishResize =
            () => this.context.publish(
                IMAGE_VIEWER_RESIZE,
                {config_id: -1, window_resize: true});
        window.onresize = () => {
            if (typeof this.resizeHandle !== null) {
                clearTimeout(this.resizeHandle);
                this.resizeHandle = null;
            }
            this.resizeHandle = setTimeout(publishResize, 50);
        };
        window.onbeforeunload = () => {
            if (Misc.useJsonp(this.context.server)) return null;
            let hasBeenModified = false;
            for (var [k,v] of this.context.image_configs) {
                if (v && v.regions_info && v.regions_info.hasBeenModified() &&
                    v.regions_info.image_info.can_annotate) {
                    hasBeenModified = true;
                    break;
                }
            }
            if (hasBeenModified)
                return "You have new/deleted/modified ROI(S).\n" +
                        "If you leave you'll lose your changes.";
            return null;
        };
        // register resize and collapse handlers
        Ui.registerSidePanelHandlers(
            this.context.eventbus,
            this.context.getPrefixedURI(PLUGIN_PREFIX, true),
        );
    }

    /**
     * Closes viewer in MDI mode checking whether there is a need
     * to store
     *
     * @memberof Index
     */
    closeViewerInMDI(id) {
        if (!this.context.useMDI) return;

        let conf = this.context.getImageConfig(id);
        if (conf === null || conf.regions_info === null ||
            !conf.regions_info.hasBeenModified() ||
            Misc.useJsonp(this.context.server) ||
            !conf.regions_info.image_info.can_annotate) {
                this.context.removeImageConfig(id);
                return;
            };

            let saveHandler = () => {
                let tmpSub =
                    this.context.eventbus.subscribe(
                        REGIONS_STORED_SHAPES,
                        (params={}) => {
                            tmpSub.dispose();
                            this.context.removeImageConfig(id);
                    });
                setTimeout(()=>
                    this.context.publish(
                        REGIONS_STORE_SHAPES,
                        {config_id : conf.id,
                         omit_client_update: true}), 20);
            };
            Ui.showConfirmationDialog(
                'Save ROIS?',
                'You have new/deleted/modified ROI(S).<br>' +
                'Do you want to save your changes?',
                saveHandler, () => this.context.removeImageConfig(id));
    }

    /**
     * Adds/Removes the given image config to the sync group
     * @param {number} id the image config id
     * @param {string|null} group the sync group or null
     * @memberof Index
     */
    toggleSyncGroup(id, group=null) {
        let conf = this.context.getImageConfig(id);
        if (conf === null) return;

        conf.toggleSyncGroup(group);
        this.context
    }

    /**
     * Visually highlights image configs contained in group
     * @param {Array.<number>} group the group containing the image configs
     * @param {boolean} flag if true we highlight, otherwise not
     * @memberof Index
     */
    highlightSyncGroup(group = [], flag) {
        for (let g in group)
            $('#' + group[g]).css("border-color", flag ? "yellow" : "");
    }

    /**
     * Turns on/off syncing locks
     *
     * @param {number} id the image config id
     * @param {string} lock the sync lock, e.g. z, t, c or v
     * @param {boolean} flag if true the lock is applied, otherwise not
     * @memberof Index
     */
    toggleSyncLock(id, lock = 'c', flag) {
        let conf = this.context.getImageConfig(id);
        if (conf === null || conf.sync_group === null) return;
        let syncGroup = this.context.sync_groups.get(conf.sync_group);
        if (syncGroup) {
            syncGroup.sync_locks[lock] = flag;
        }
    }

    /**
     * Overridden aurelia lifecycle method:
     * called when the view and its elemetns are detached from the PAL
     * (dom abstraction)
     *
     * @memberof Index
     */
    detached() {
        window.onresize = null;
        window.onbeforeunload = null;
    }
}
