/**
 * The CSSTransitionGroup component uses the 'transitionend' event, which
 * browsers will not send for any number of reasons, including the
 * transitioning node not being painted or in an unfocused tab.
 *
 * This TimeoutTransitionGroup instead uses a user-defined timeout to determine
 * when it is a good time to remove the component. Currently there is only one
 * timeout specified, but in the future it would be nice to be able to specify
 * separate timeouts for enter and leave, in case the timeouts for those
 * animations differ. Even nicer would be some sort of inspection of the CSS to
 * automatically determine the duration of the animation or transition.
 *
 * This is adapted from Facebook's CSSTransitionGroup which is in the React
 * addons and under the Apache 2.0 License.
 */

'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var React = require('react');
var ReactDom = require('react-dom');
var ReactTransitionGroup = require('react-addons-transition-group');
var TICK = 17;

/**
 * EVENT_NAME_MAP is used to determine which event fired when a
 * transition/animation ends, based on the style property used to
 * define that event.
 */
var EVENT_NAME_MAP = {
    transitionend: {
        'transition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd',
        'MozTransition': 'mozTransitionEnd',
        'OTransition': 'oTransitionEnd',
        'msTransition': 'MSTransitionEnd'
    },

    animationend: {
        'animation': 'animationend',
        'WebkitAnimation': 'webkitAnimationEnd',
        'MozAnimation': 'mozAnimationEnd',
        'OAnimation': 'oAnimationEnd',
        'msAnimation': 'MSAnimationEnd'
    }
};

var endEvents = [];

(function detectEvents() {
    if (typeof window === "undefined") {
        return;
    }

    var testEl = document.createElement('div');
    var style = testEl.style;

    // On some platforms, in particular some releases of Android 4.x, the
    // un-prefixed "animation" and "transition" properties are defined on the
    // style object but the events that fire will still be prefixed, so we need
    // to check if the un-prefixed events are useable, and if not remove them
    // from the map
    if (!('AnimationEvent' in window)) {
        delete EVENT_NAME_MAP.animationend.animation;
    }

    if (!('TransitionEvent' in window)) {
        delete EVENT_NAME_MAP.transitionend.transition;
    }

    for (var baseEventName in EVENT_NAME_MAP) {
        if (EVENT_NAME_MAP.hasOwnProperty(baseEventName)) {
            var baseEvents = EVENT_NAME_MAP[baseEventName];
            for (var styleName in baseEvents) {
                if (styleName in style) {
                    endEvents.push(baseEvents[styleName]);
                    break;
                }
            }
        }
    }
})();

function animationSupported() {
    return endEvents.length !== 0;
}

function addEventListener(node, eventName, eventListener) {
    node.addEventListener(eventName, eventListener, false);
}

function removeEventListener(node, eventName, eventListener) {
    node.removeEventListener(eventName, eventListener, false);
}

/**
 * Functions for element class management to replace dependency on jQuery
 * addClass, removeClass and hasClass
 */
function addClass(element, className) {
    if (element.classList) {
        element.classList.add(className);
    } else if (!hasClass(element, className)) {
        element.className = element.className + ' ' + className;
    }
    return element;
}

function removeClass(element, className) {
    if (hasClass(element, className)) {
        if (element.classList) {
            element.classList.remove(className);
        } else {
            element.className = (' ' + element.className + ' ').replace(' ' + className + ' ', ' ').trim();
        }
    }
    return element;
}
function hasClass(element, className) {
    if (element.classList) {
        return element.classList.contains(className);
    } else {
        return (' ' + element.className + ' ').indexOf(' ' + className + ' ') > -1;
    }
}

var TimeoutTransitionGroupChild = React.createClass({
    displayName: 'TimeoutTransitionGroupChild',

    statics: {
        leaveTranstion: false
    },
    transition: function transition(animationType, finishCallback) {
        var node = ReactDom.findDOMNode(this);
        var className = this.props.name + '-' + animationType;
        var activeClassName = className + '-active';

        var endListener = function endListener() {
            removeClass(node, className);
            removeClass(node, activeClassName);
            endEvents.forEach(function (endEvent) {
                removeEventListener(node, endEvent, endListener);
            });
            // Usually this optional callback is used for informing an owner of
            // a leave animation and telling it to remove the child.
            finishCallback && finishCallback();
        };

        if (!animationSupported()) {
            endListener();
        } else {
            if (this.props.enterTimeout && (animationType === "enter" || animationType === "appear")) {
                this.animationTimeout = setTimeout(endListener, this.props.enterTimeout);
            } else if (this.props.leaveTimeout && animationType === "leave") {
                this.animationTimeout = setTimeout(endListener, this.props.leaveTimeout);
            } else {
                endEvents.forEach(function (endEvent) {
                    addEventListener(node, endEvent, endListener);
                });
            }
        }

        addClass(node, className);

        // Need to do this to actually trigger a transition.
        this.queueClass(activeClassName);
    },

    queueClass: function queueClass(className) {
        this.classNameQueue.push(className);

        if (!this.timeout) {
            this.timeout = setTimeout(this.flushClassNameQueue, TICK);
        }
    },

    flushClassNameQueue: function flushClassNameQueue() {
        var node = ReactDom.findDOMNode(this);
        if (this.isMounted()) {
            this.classNameQueue.forEach(function (name) {
                addClass(node, name);
            }.bind(this));
        }
        this.classNameQueue.length = 0;
        this.timeout = null;
    },

    componentWillMount: function componentWillMount() {
        TimeoutTransitionGroupChild.leaveTransition = false;
        this.classNameQueue = [];
    },

    componentWillUnmount: function componentWillUnmount() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        if (this.animationTimeout) {
            clearTimeout(this.animationTimeout);
        }
    },

    componentWillEnter: function componentWillEnter(done) {
        if (this.props.enter) {
            this.transition('enter', done);
        } else {
            done();
        }
    },

    componentWillAppear: function componentWillAppear(done) {
        if (this.props.appear) {
            this.transition('appear', done);
        } else {
            done();
        }
    },

    componentWillLeave: function componentWillLeave(done) {
        TimeoutTransitionGroupChild.leaveTransition = true;
        if (this.props.leave) {
            this.transition('leave', done);
        } else {
            done();
        }
    },

    componentDidUpdate: function componentDidUpdate() {
        if (TimeoutTransitionGroupChild.leaveTransition) {
            this.props.onTransitionEnd();
        }
    },

    render: function render() {
        return React.Children.only(this.props.children);
    }
});

var TimeoutTransitionGroup = React.createClass({
    displayName: 'TimeoutTransitionGroup',

    propTypes: {
        enterTimeout: React.PropTypes.number,
        leaveTimeout: React.PropTypes.number,
        transitionName: React.PropTypes.string,
        transitionEnter: React.PropTypes.bool,
        transitionLeave: React.PropTypes.bool,
        transitionAppear: React.PropTypes.bool
    },

    getDefaultProps: function getDefaultProps() {
        return {
            transitionEnter: true,
            transitionLeave: true
        };
    },

    _wrapChild: function _wrapChild(child) {
        return React.createElement(
            TimeoutTransitionGroupChild,
            {
                enterTimeout: this.props.enterTimeout,
                leaveTimeout: this.props.leaveTimeout,
                name: this.props.transitionName,
                enter: this.props.transitionEnter,
                appear: this.props.transitionAppear,
                leave: this.props.transitionLeave,
                onTransitionEnd: this.props.onTransitionEnd },
            child
        );
    },

    render: function render() {
        return React.createElement(ReactTransitionGroup, _extends({}, this.props, {
            childFactory: this._wrapChild }));
    }
});

module.exports = TimeoutTransitionGroup;