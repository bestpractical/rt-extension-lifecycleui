jQuery(function () {
    var _ELEMENT_KEY_SEQ = 0;
    var defaultColors = d3.scaleOrdinal(d3.schemeCategory10);

    function Lifecycle () {
        this.statuses = [];
        this.defaults = {};
        this.transitions = [];
        this.rights = {};
        this.actions = [];
        this.decorations = {};

        this.statusMeta = {};
    };

    Lifecycle.prototype.initializeFromConfig = function (config) {
        var self = this;

        jQuery.each(['initial', 'active', 'inactive'], function (i, type) {
            if (config[type]) {
                self.statuses = self.statuses.concat(config[type]);
                jQuery.each(config[type], function (j, statusName) {
                    self.statusMeta[statusName] = {
                        _key: _ELEMENT_KEY_SEQ++,
                        name: statusName,
                        type: type
                    };
                });
            }
        });

        var statusCount = self.statuses.length;

        jQuery.each(self.statuses, function (i, statusName) {
            var meta = self.statusMeta[statusName];
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
                }
                else {
                    jQuery.each(toList, function (i, toStatus) {
                        var transition = {
                            _key  : _ELEMENT_KEY_SEQ++,
                            from  : fromStatus,
                            to    : toStatus,
                            style : 'solid'
                        };
                        self.transitions.push(transition);
                    });
                }
            });
        }

        if (config.rights) {
            self.rights = config.rights;
        }

        if (config.actions) {
            self.actions = config.actions;
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
            rights: self.rights,
            transitions: self.transitions
        };

        jQuery.each(self.statuses, function (i, statusName) {
            var statusType = self.statusMeta[statusName].type;
            config[statusType].push(statusName);
        });

        var transitions = {};
        jQuery.each(self.transitions, function (i, transition) {
            var from = transition.from;
            var to = transition.to;
            if (!transitions[from]) {
                transitions[from] = [];
            }
            transitions[from].push(to);
            config.transitions = transitions;
        });

        return config;
    };

    Lifecycle.prototype.addTransition = function (fromStatus, toStatus) {
        var transition = {
            _key  : _ELEMENT_KEY_SEQ++,
            from  : fromStatus,
            to    : toStatus,
            style : 'solid'
        };
        this.transitions.push(transition);
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

    RT.Lifecycle = Lifecycle;
});

