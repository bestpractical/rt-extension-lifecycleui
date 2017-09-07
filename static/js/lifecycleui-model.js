jQuery(function () {
    var _ELEMENT_KEY_SEQ = 0;
    var defaultColors = d3.scaleOrdinal(d3.schemeCategory10);

    function Lifecycle (name) {
        this.name = name;
        this.type = 'ticket';
        this.is_ticket = true;
        this.statuses = [];
        this.defaults = {};
        this.transitions = [];
        this.decorations = {};

        this._undoStack = [];
        this._keyMap = {};
        this._statusMeta = {};

        this._initialPointsForPolygon = {
            Triangle: [
                {x:  .07, y: .2},
                {x:    0, y:  0},
                {x: -.06, y: .2}
            ],
            Rectangle: [
                {x: -.06, y: -.06},
                {x:  .06, y: -.06},
                {x:  .06, y:  .06},
                {x: -.06, y:  .06}
            ]
        };
    };

    Lifecycle.prototype.initializeFromConfig = function (config) {
        var self = this;

        if (config.type) {
            self.type = config.type;
            self.is_ticket = self.type == 'ticket';
        }

        if (config.ticket_display) {
            self.ticket_display = config.ticket_display;
        }

        jQuery.each(['initial', 'active', 'inactive'], function (i, type) {
            if (config[type]) {
                self.statuses = self.statuses.concat(config[type]);
                jQuery.each(config[type], function (j, statusName) {
                    var item;
                    if (config.statusExtra) {
                        item = config.statusExtra[statusName] || {};
                    }
                    else {
                        item = {};
                    }
                    item._key  = _ELEMENT_KEY_SEQ++;
                    item._type = 'status';
                    item.name  = statusName;
                    item.type  = type;
                    self._statusMeta[statusName] = item;
                    self._keyMap[item._key] = item;
                });
            }
        });

        var statusCount = self.statuses.length;

        jQuery.each(self.statuses, function (i, statusName) {
            var meta = self._statusMeta[statusName];
            // arrange statuses evenly-spaced around a circle
            if (!meta.x) {
                meta.x = (Math.sin(2 * Math.PI * (i/statusCount)) + 1) / 2;
                meta.y = (Math.cos(2 * Math.PI * (i/statusCount)) + 1) / 2;
            };

            if (!meta.color) {
                meta.color = defaultColors(meta._key);
            };
        });

        if (config.defaults) {
            self.defaults = config.defaults;
        }

        if (config.transitions) {
            jQuery.each(config.transitions, function (fromStatus, toList) {
                if (fromStatus == "") {
                    jQuery.each(toList, function (i, toStatus) {
                        self._statusMeta[toStatus].creation = true;
                    });
                }
                else {
                    jQuery.each(toList, function (i, toStatus) {
                        var description = fromStatus + ' -> ' + toStatus;
                        var transition;
                        if (config.transitionExtra) {
                            transition = config.transitionExtra[description] || {};
                        }
                        else {
                            transition = {};
                        }
                        transition._key    = _ELEMENT_KEY_SEQ++;
                        transition._type   = 'transition';
                        transition.from    = fromStatus;
                        transition.to      = toStatus;
                        transition.style   = transition.style || 'solid';
                        transition.actions = [];

                        self.transitions.push(transition);
                        self._keyMap[transition._key] = transition;
                    });
                }
            });
        }

        if (config.rights) {
            jQuery.each(config.rights, function (description, right) {
                jQuery.each(self.transitions, function (i, transition) {
                    var from = transition.from;
                    var to = transition.to;

                    if (description == (from + ' -> ' + to)
                     || description == ('* -> ' + to)
                     || description == (from + ' -> *')
                     || description == ('* -> *')) {
                        transition.right = right;
                    }
                });
            });
        }

        jQuery.each(self.transitions, function (i, transition) {
            if (!transition.right) {
                transition.right = self.defaultRightForTransition(transition);
            }
        });

        if (config.actions) {
            var actions = config.actions;

            // convert hash-based actions to array of pairs
            if (jQuery.type(config.actions) == "object") {
                actions = [];
                jQuery.each(config.actions, function(description, action) {
                    actions.push(description, action);
                });
            }

            for (var i = 0; i < actions.length; ++i) {
                var description;
                var spec;

                if (jQuery.type(actions[i]) == "string") {
                    description = actions[i];
                    spec = actions[++i];
                }
                else {
                    spec = actions[i];
                    var from = (delete spec.from) || '*';
                    var to = (delete spec.to) || '*';
                    description = from + ' -> ' + to;
                }

                jQuery.each(self.transitions, function (i, transition) {
                    var from = transition.from;
                    var to = transition.to;

                    if (description == (from + ' -> ' + to)
                     || description == ('* -> ' + to)
                     || description == (from + ' -> *')
                     || description == ('* -> *')) {
                        var action = jQuery.extend({}, spec);
                        action._key = _ELEMENT_KEY_SEQ++;
                        action._type = 'action';
                        transition.actions.push(action);
                        self._keyMap[action._key] = action;
                    }
                });
            }
        }

        self.decorations = {};

        jQuery.each(['text', 'polygon', 'circle', 'line'], function (i, type) {
            var decorations = [];

            if (config.decorations && config.decorations[type]) {
                jQuery.each(config.decorations[type], function (i, decoration) {
                    decoration._key = _ELEMENT_KEY_SEQ++;
                    decoration._type = type;
                    decorations.push(decoration);
                    self._keyMap[decoration._key] = decoration;
                });
            }

            self.decorations[type] = decorations;
        });
    };

    Lifecycle.prototype.defaultRightForTransition = function (transition) {
        if (this.type == 'asset') {
            return 'ModifyAsset';
        }

        if (transition.to == 'deleted') {
            return 'DeleteTicket';
        }

        return 'ModifyTicket';
    };

    Lifecycle.prototype._sanitizeForExport = function (o) {
        var clone = jQuery.extend(true, {}, o);
        var type = o._type;
        jQuery.each(clone, function (key, value) {
            if (key.substr(0, 1) == '_') {
                delete clone[key];
            }
        });

        // remove additional redundant information to provide a single source
        // of truth
        if (type == 'status') {
            delete clone.name;
            delete clone.type;
            delete clone.creation;
        }
        else if (type == 'transition') {
            delete clone.from;
            delete clone.to;
            delete clone.actions;
            delete clone.right;
        }

        return clone;
    };

    Lifecycle.prototype.exportAsConfiguration = function () {
        var self = this;
        var config = {
            type: self.type,
            initial: [],
            active: [],
            inactive: [],
            defaults: self.defaults,
            actions: [],
            rights: {},
            transitions: self.transitions,

            ticket_display: self.ticket_display,
            decorations: {},
            statusExtra: {},
            transitionExtra: {}
        };

        var transitions = { "": [] };

        jQuery.each(self.statuses, function (i, statusName) {
            var meta = self._statusMeta[statusName];
            var statusType = meta.type;
            config[statusType].push(statusName);
            config.statusExtra[statusName] = self._sanitizeForExport(meta);

            if (meta.creation) {
                transitions[""].push(statusName);
            }
        });

        jQuery.each(self.transitions, function (i, transition) {
            var from = transition.from;
            var to = transition.to;
            var description = transition.from + ' -> ' + transition.to;

            config.transitionExtra[description] = self._sanitizeForExport(transition);

            if (!transitions[from]) {
                transitions[from] = [];
            }
            transitions[from].push(to);

            if (transition.right) {
                config.rights[description] = transition.right;
            }

            jQuery.each(transition.actions, function (i, action) {
                if (action.label) {
                    var serialized = { label : action.label };
                    if (action.update) {
                        serialized.update = action.update;
                    }
                    config.actions.push(description, serialized);
                }
            });
        });

        config.transitions = transitions;

        config.decorations = {};
        jQuery.each(self.decorations, function (type, decorations) {
            var out = [];
            jQuery.each(decorations, function (i, decoration) {
                out.push(self._sanitizeForExport(decoration));
            });
            config.decorations[type] = out;
        });

        return config;
    };

    Lifecycle.prototype.updateStatusName = function (oldValue, newValue) {
        var self = this;

        // statusMeta key
        var oldMeta = self._statusMeta[oldValue];
        delete self._statusMeta[oldValue];
        self._statusMeta[newValue] = oldMeta;

        // statuses array value
        var index = self.statuses.indexOf(oldValue);
        self.statuses[index] = newValue;

        // defaults
        jQuery.each(self.defaults, function (key, statusName) {
            if (statusName == oldValue) {
                self.defaults[key] = newValue;
            }
        });

        // transitions
        jQuery.each(self.transitions, function (i, transition) {
            if (transition.from == oldValue) {
                transition.from = newValue;
            }
            if (transition.to == oldValue) {
                transition.to = newValue;
            }
        });
    };

    Lifecycle.prototype.statusNameForKey = function (key) {
        return this._keyMap[key].name;
    };

    Lifecycle.prototype.statusObjects = function () {
        return Object.values(this._statusMeta);
    };

    Lifecycle.prototype.keyForStatusName = function (statusName) {
        return this._statusMeta[statusName]._key;
    };

    Lifecycle.prototype.statusObjectForName = function (statusName) {
        return this._statusMeta[statusName];
    };

    Lifecycle.prototype.deleteStatus = function (key) {
        var self = this;

        self._saveUndoEntry();

        var statusName = self.statusNameForKey(key);
        if (!statusName) {
            console.error("no status for key '" + key + "'; did you accidentally pass status name?");
        }

        // internal book-keeping
        delete self._statusMeta[statusName];
        delete self._keyMap[key];

        // statuses array value
        var index = self.statuses.indexOf(statusName);
        self.statuses.splice(index, 1);

        // defaults
        jQuery.each(self.defaults, function (key, value) {
            if (value == statusName) {
                delete self.defaults[key];
            }
        });

        // transitions
        self.transitions = jQuery.grep(self.transitions, function (transition) {
            if (transition.from == statusName || transition.to == statusName) {
                return false;
            }
            return true;
        });
    };

    Lifecycle.prototype.addTransition = function (fromStatus, toStatus) {
        this._saveUndoEntry();

        var transition = {
            _key    : _ELEMENT_KEY_SEQ++,
            _type   : 'transition',
            from    : fromStatus,
            to      : toStatus,
            style   : 'solid',
            actions : []
        };
        this.transitions.push(transition);
        this._keyMap[transition._key] = transition;

        transition.right = this.defaultRightForTransition(transition);

        return transition;
    };

    Lifecycle.prototype.hasTransition = function (fromStatus, toStatus) {
        if (fromStatus == toStatus || !fromStatus || !toStatus) {
            return false;
        }

        for (var i = 0; i < this.transitions.length; ++i) {
            var transition = this.transitions[i];
            if (transition.from == fromStatus && transition.to == toStatus) {
                return transition;
            }
        };

        return false;
    };

    Lifecycle.prototype.transitionsFrom = function (fromStatus) {
        var transitions = [];
        for (var i = 0; i < this.transitions.length; ++i) {
            var transition = this.transitions[i];
            if (transition.from == fromStatus) {
                transitions.push(transition);
            }
        };
        return transitions;
    };

    Lifecycle.prototype.transitionsTo = function (toStatus) {
        var transitions = [];
        for (var i = 0; i < this.transitions.length; ++i) {
            var transition = this.transitions[i];
            if (transition.to == toStatus) {
                transitions.push(transition);
            }
        };
        return transitions;
    };

    Lifecycle.prototype.deleteTransition = function (key) {
        this._saveUndoEntry();

        this.transitions = jQuery.grep(this.transitions, function (transition) {
            if (transition._key == key) {
                return false;
            }
            return true;
        });
        delete this._keyMap[key];
    };

    Lifecycle.prototype.deleteDecoration = function (type, key) {
        this._saveUndoEntry();

        this.decorations[type] = jQuery.grep(this.decorations[type], function (decoration) {
            if (decoration._key == key) {
                return false;
            }
            return true;
        });
        delete this._keyMap[key];
    };

    Lifecycle.prototype.itemForKey = function (key) {
        return this._keyMap[key];
    };

    Lifecycle.prototype.deleteItemForKey = function (key) {
        var item = this.itemForKey(key);
        var type = item._type;

        if (type == 'status') {
            this.deleteStatus(key);
        }
        else if (type == 'transition') {
            this.deleteTransition(key);
        }
        else if (type == 'text' || type == 'polygon' || type == 'circle' || type == 'line') {
            this.deleteDecoration(type, key);
        }
        else {
            console.error("unhandled type '" + type + "'");
        }
    };

    Lifecycle.prototype.deleteActionForTransition = function (transition, key) {
        this._saveUndoEntry();

        transition.actions = jQuery.grep(transition.actions, function (action) {
            if (action._key == key) {
                return false;
            }
            return true;
        });
        delete this._keyMap[key];
    };

    Lifecycle.prototype.updateItem = function (item, field, newValue, skipUndo) {
        if (!skipUndo) {
            this._saveUndoEntry();
        }

        var oldValue = item[field];

        item[field] = newValue;

        if (item._type == 'status' && field == 'name') {
            this.updateStatusName(oldValue, newValue);
        }
    };

    Lifecycle.prototype.createActionForTransition = function (transition) {
        this._saveUndoEntry();

        var action = {
            _type : 'action',
            _key  : _ELEMENT_KEY_SEQ++,
        };
        transition.actions.push(action);
        this._keyMap[action._key] = action;
        return action;
    };

    Lifecycle.prototype.beginDragging = function () {
        this._saveUndoEntry();
    };

    Lifecycle.prototype.beginChangingColor = function () {
        this._saveUndoEntry();
    };

    Lifecycle.prototype.moveItem = function (item, x, y) {
        item.x = x;
        item.y = y;
    };

    Lifecycle.prototype.movePolygonPoint = function (polygon, index, x, y) {
        var point = polygon.points[index];
        point.x = x;
        point.y = y;
    };

    Lifecycle.prototype.createStatus = function () {
        this._saveUndoEntry();

        var name;
        var i = 0;
        while (1) {
            name = 'status #' + ++i;
            if (!this._statusMeta[name]) {
                break;
            }
        }

        this.statuses.push(name);

        var item = {
            _key: _ELEMENT_KEY_SEQ++,
            _type: 'status',
            name:  name,
            type:  'initial',
            x:     0.5,
            y:     0.5,
        };
        item.color = defaultColors(item._key);

        this._statusMeta[name] = item;
        this._keyMap[item._key] = item;
        return item;
    };

    Lifecycle.prototype.createTextDecoration = function () {
        this._saveUndoEntry();

        var item = {
            _key: _ELEMENT_KEY_SEQ++,
            _type: 'text',
            text:  'New label',
            x:     0.5,
            y:     0.5,
        };
        this.decorations.text.push(item);
        this._keyMap[item._key] = item;
        return item;
    };

    Lifecycle.prototype.createPolygonDecoration = function (type) {
        this._saveUndoEntry();

        var item = {
            _key: _ELEMENT_KEY_SEQ++,
            _type: 'polygon',
            label: type,
            stroke: '#000000',
            renderStroke: true,
            strokeStyle: 'solid',
            fill: '#ffffff',
            renderFill: true,
            x: 0.5,
            y: 0.5,
            points: this._initialPointsForPolygon[type]
        };
        this.decorations.polygon.push(item);
        this._keyMap[item._key] = item;
        return item;
    };

    Lifecycle.prototype.createCircleDecoration = function () {
        this._saveUndoEntry();

        var item = {
            _key: _ELEMENT_KEY_SEQ++,
            _type: 'circle',
            label: 'Circle',
            stroke: '#000000',
            renderStroke: true,
            strokeStyle: 'solid',
            fill: '#ffffff',
            renderFill: true,
            x: 0.5,
            y: 0.5,
            r: 35
        };
        this.decorations.circle.push(item);
        this._keyMap[item._key] = item;
        return item;
    };

    Lifecycle.prototype.createLineDecoration = function () {
        this._saveUndoEntry();

        var item = {
            _key: _ELEMENT_KEY_SEQ++,
            _type: 'line',
            label: 'Line',
            style: 'solid',
            startMarker: 'none',
            endMarker: 'arrowhead',
            points: [{x:0.4, y:0.5}, {x:0.6, y:0.5}]
        };
        this.decorations.line.push(item);
        this._keyMap[item._key] = item;
        return item;
    };

    Lifecycle.prototype.update = function (field, value) {
        this._saveUndoEntry();

        if (field == 'on_create' || field == 'approved' || field == 'denied' || field == 'reminder_on_open' || field == 'reminder_on_resolve') {
            this.defaults[field] = value;
        }
        else if (field == 'ticket_display') {
            this[field] = value;
        }
        else {
            console.error("Unhandled field in Lifecycle.update: " + field);
        }
    };

    Lifecycle.prototype._saveUndoEntry = function () {
        var undoStack = this._undoStack;
        delete this._undoStack;
        var entry = jQuery.extend(true, {}, this);
        var extra = {};
        if (this.saveUndoCallback) {
            extra = this.saveUndoCallback();
        }
        undoStack.push([entry, extra]);
        this._undoStack = undoStack;

        if (this.undoStackChangedCallback) {
            this.undoStackChangedCallback();
        }
    };

    Lifecycle.prototype.hasUndoStack = function () {
        return this._undoStack.length > 0;
    };

    Lifecycle.prototype.undo = function () {
        var undoStack = this._undoStack;
        if (undoStack.length == 0) {
            return null;
        }

        delete this._undoStack;
        var payload = undoStack.pop();
        var entry = payload[0];

        for (var key in entry) {
            if (entry.hasOwnProperty(key)) {
                this[key] = entry[key];
            }
        }

        this._undoStack = undoStack;

        if (this.undoStackChangedCallback) {
            this.undoStackChangedCallback();
        }

        return payload[1];
    };

    RT.Lifecycle = Lifecycle;
});

