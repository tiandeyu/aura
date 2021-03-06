/*
 * Copyright (C) 2013 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
({
	cellStatuses : ['edited', 'disabled', 'hasErrors'],
	PANEL_SUBMIT_ON_DEFAULT : 'keydown',
	
	initializeColumns : function(cmp) {
	    var columns = cmp.get("v.columns");
	    var itemVar = cmp.get("v.itemVar");
	    
	    for (var i = 0; i < columns.length; i++) {
            this.initializeCellStates(columns[i], itemVar);
        }
        
        cmp.find("grid").set("v.columns", columns);
	},
	
	initializeCellStates : function(cellComponentDef, itemVar) {
		var values = cellComponentDef.attributes.values;
		
		// May need some sort of interface to make sure we have these values?
		if (values.name) {
			var name = values.name.value;
			
			for (var i = 0; i < this.cellStatuses.length; i++) {
				var status = this.cellStatuses[i];
				if (!values[status]) {
					values[status] = this.generateStatusExpressionObj(itemVar, name, status);
				}
			}
		}
	},
	
	generateStatusExpressionObj : function(itemVar, name, status) {
		return {
			descriptor : status,
			value : '{!' + itemVar + '.status.' + name + '.' + status + '}'
		};
	},
	
	handleEditAction : function(cmp, evt) {
	    var index = evt.getParam("index");
        var payload = evt.getParam("payload");
        
        var editLayouts = cmp.get("v.editLayouts") || {};
        var editLayout = editLayouts[payload.name];
        
        if (editLayout) {
            // TODO: Need check that editLayout follows a certain interface so we can attach the appropriate
            // attributes and events.
            if (!editLayout.attributes) {
                editLayout.attributes = { values : {} };
            }

			editLayout.attributes.values.value = payload.value;
			// We have to create the component first because ui:input doesn't render the errors on
			// creation time, but only when being triggered through a change handler.
			// so, we set the errors via cmp.set in order to trigger the change handler
			var inputComponent = $A.createComponentFromConfig(editLayout);
			inputComponent.set("v.errors", payload.errors);

            var panelBodyConfig = this.getPanelBodyConfig(cmp, payload.name);
            var panelBodyAttributes = {
                    index : index,
                    submitOn : panelBodyConfig.submitOn,
                    updateMap : panelBodyConfig.updateMap,
                    inputComponent : inputComponent
            };
            
            this.displayEditPanel(cmp, panelBodyAttributes, payload.targetElement);
        }
	},
	
	createEditPanel : function(cmp, newPanelBody, referenceElement) {
		var _keyNav = this.lib.keyNav;
		var config = this.getPanelConfig(referenceElement);
		
		newPanelBody.addHandler('submit', cmp, 'c.handlePanelSubmit');
		config.body = newPanelBody;
		
		$A.get('e.ui:createPanel').setParams({
			panelType : 'inlinePanel',
			visible : true,
			panelConfig : config,
			onCreate : function(panel) {
				cmp._panelCmp = panel;
			},
			onDestroy : function(){
				// On Esc set focus for keyboard interaction and resume keyboard mode
				_keyNav._setActiveCell(_keyNav.activeRowIndex,_keyNav.activeColumnIndex);
				_keyNav.resumeKeyboardMode();
			}
		}).fire();
	},
	displayEditPanel : function(cmp, panelBodyAttributes, referenceElement) {
		var self = this;
		
		// TODO: Unable to reuse panels due to W-2802284
		/*if (cmp._panelCmp && cmp._panelCmp.isValid()) {
			var panelCmp = cmp._panelCmp;
			var panelBody = cmp._panelBody;
			
			panelCmp.set("v.referenceElement", referenceElement);
			
			panelBody.set("v.index", panelBodyAttributes.index);
			panelBody.set("v.key", panelBodyAttributes.key);
			panelBody.set("v.inputComponent", panelBodyAttributes.inputComponent);
			
			panelCmp.show();
		} else {*/
			$A.createComponent('markup://ui:inlineEditPanelBody',
				panelBodyAttributes,
				function(newPanelBody) {
					cmp._panelBody = newPanelBody;
					self.createEditPanel(cmp, newPanelBody, referenceElement);
				});
		//}
	},
	
	getPanelBodyConfig: function(cmp, name) {
	    var config = cmp.get("v.editPanelConfigs");
	    var panelBodyConfig = config ? (config[name] || {}) : {};   
	    
	    if ($A.util.isEmpty(panelBodyConfig.updateMap)) {
	        panelBodyConfig.updateMap = this.getDefaultUpdateMap(name);
	    }
	    
	    if ($A.util.isEmpty(panelBodyConfig.submitOn)) {
	        panelBodyConfig.submitOn = this.PANEL_SUBMIT_ON_DEFAULT;
	    }
	    
	    return panelBodyConfig;
	},
	
	getPanelConfig: function(referenceElement) {
        return {
            referenceElement: referenceElement,
            closeOnClickOut: true,
			closeAction: $A.getCallback(function(panel, closeBehavior) {
				if (closeBehavior !== "closeOnEsc") {
					panel.get("v.body")[0].submitValues(closeBehavior);
				}
				else {
					panel.hide();
					this.lib.keyNav.resumeKeyboardMode();
				}
			}.bind(this))
        };
    },

	initKeyboardEntry: function(cmp){
		this.lib.keyNav.initKeyboardEntry(cmp);
	},
	destroyKeyboard: function(cmp){
		this.lib.keyNav.destroyKeyboard(cmp);
	},
	handleEnableKeyboardMode: function(cmp){
		if (cmp.get("v.enableKeyboardMode")) {
			this.initKeyboardEntry(cmp);
		}
		else {
			this.destroyKeyboard(cmp);
		}
	},
	updateItem: function(cmp, item, index){
		cmp.find('grid').updateItem(item, index);
	},
	updateHeaderColumns: function(cmp) {
	    cmp.find("grid").set("v.headerColumns", cmp.get("v.headerColumns"));
	},
	getDefaultUpdateMap: function(name) {
	    var map = {};
	    map[name] = 'value';
	    return map;
	},

	/* UTILITY FUNCTIONS */
	bubbleEvent : function(cmp, evt, eventName) {
		cmp.getEvent(eventName).setParams(evt.getParams()).fire();
	},
	fireEditEvent : function(cmp, params) {
	    cmp.getEvent("onEdit").setParams({
            index : params.index,
            values : params.values
        }).fire();
	},
	fireKeyboardModeEnterEvent: function(cmp) {
 		cmp.getEvent("onKeyboardModeEnter").fire();
 	},
 	fireKeyboardModeExitEvent: function(cmp) {
 		cmp.getEvent("onKeyboardModeExit").fire();
 	},
	fireShortcutSaveEvent: function(cmp) {
		cmp.getEvent("onKeyboardShortcut").setParams({
			action : "shortcut",
			payload : "save"
		}).fire();
	},
	fireShortcutCancelEvent: function(cmp) {
		cmp.getEvent("onKeyboardShortcut").setParams({
			action : "shortcut",
			payload : "cancel"
		}).fire();
	}
})// eslint-disable-line semi