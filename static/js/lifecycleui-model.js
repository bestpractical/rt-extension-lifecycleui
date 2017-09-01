jQuery(function () {
    var _ELEMENT_KEY_SEQ = 0;
    var defaultColors = d3.scaleOrdinal(d3.schemeCategory10);

    function Lifecycle () {
        this.statuses = [];
        this.defaults = {};
        this.transitions = [];
        this.decorations = {};

        this._keyMap = {};
        this._statusMeta = {};
    };

    Lifecycle.prototype.initializeFromConfig = function (config) {
        var self = this;

        jQuery.each(['initial', 'active', 'inactive'], function (i, type) {
            if (config[type]) {
                self.statuses = self.statuses.concat(config[type]);
                jQuery.each(config[type], function (j, statusName) {
                    var item = {
                        _key:  _ELEMENT_KEY_SEQ++,
                        _type: 'status',
                        name:  statusName,
                        type:  type
                    };
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
                        var transition = {
                            _key    : _ELEMENT_KEY_SEQ++,
                            _type   : 'transition',
                            from    : fromStatus,
                            to      : toStatus,
                            style   : 'solid',
                            actions : []
                        };
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

        if (config.actions) {
            for (var i = 0; i < config.actions.length; i += 2) {
                var description = config.actions[i];
                var action = config.actions[i+1];

                jQuery.each(self.transitions, function (i, transition) {
                    var from = transition.from;
                    var to = transition.to;

                    if (description == (from + ' -> ' + to)
                     || description == ('* -> ' + to)
                     || description == (from + ' -> *')
                     || description == ('* -> *')) {
                        action._key = _ELEMENT_KEY_SEQ++;
                        action._type = 'action';
                        transition.actions.push(action);
                        self._keyMap[action._key] = action;
                    }
                });
            }
        }

        if (config.decorations) {
            self.decorations = config.decorations;
        }

        self.decorations.text = self.decorations.text || [];
    };

    Lifecycle.prototype.exportAsConfiguration = function () {
        var self = this;
        var config = {
            initial: [],
            active: [],
            inactive: [],
            defaults: self.defaults,
            actions: self.actions,
            rights: {},
            transitions: self.transitions
        };

        var transitions = { "": [] };

        jQuery.each(self.statuses, function (i, statusName) {
            var statusType = self._statusMeta[statusName].type;
            config[statusType].push(statusName);
            if (self._statusMeta[statusName].creation) {
                transitions[""].push(statusName);
            }
        });

        jQuery.each(self.transitions, function (i, transition) {
            var from = transition.from;
            var to = transition.to;
            if (!transitions[from]) {
                transitions[from] = [];
            }
            transitions[from].push(to);

            if (transition.right) {
                var description = transition.from + ' -> ' + transition.to;
                config.rights[description] = transition.right;
            }
        });

        config.transitions = transitions;

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

        // actions

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

        // actions

        // transitions
        self.transitions = jQuery.grep(self.transitions, function (transition) {
            if (transition.from == statusName || transition.to == statusName) {
                return false;
            }
            return true;
        });
    };

    Lifecycle.prototype.addTransition = function (fromStatus, toStatus) {
        var transition = {
            _key  : _ELEMENT_KEY_SEQ++,
            _type : 'transition',
            from  : fromStatus,
            to    : toStatus,
            style : 'solid'
        };
        this.transitions.push(transition);
        this._keyMap[transition._key] = transition;
        return transition;
    };

    Lifecycle.prototype.hasTransition = function (fromStatus, toStatus) {
        if (fromStatus == toStatus) {
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
        this.transitions = jQuery.grep(this.transitions, function (transition) {
            if (transition._key == key) {
                return false;
            }
            return true;
        });
        delete this._keyMap[key];
    };

    Lifecycle.prototype.deleteDecoration = function (type, key) {
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
        else if (type == 'text') {
            this.deleteDecoration(type, key);
        }
        else {
            console.error("unhandled type '" + type + "'");
        }
    };

    Lifecycle.prototype.updateItem = function (item, field, newValue) {
        var oldValue = item[field];

        item[field] = newValue;

        if (item._type == 'status' && field == 'name') {
            this.updateStatusName(oldValue, newValue);
        }
    };


    RT.Lifecycle = Lifecycle;
});

