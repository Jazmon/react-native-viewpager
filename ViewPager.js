/* eslint-disable no-underscore-dangle, no-use-before-define */
const React = require('react');
const { PropTypes } = React;

const ReactNative = require('react-native');
const {
  Dimensions,
  Text,
  View,
  TouchableOpacity,
  PanResponder,
  Animated,
  StyleSheet,
} = ReactNative;

const StaticRenderer = require('react-native/Libraries/Components/StaticRenderer');
const TimerMixin = require('react-timer-mixin');

const DefaultViewPageIndicator = require('./DefaultViewPageIndicator');
const deviceWidth = Dimensions.get('window').width;
const ViewPagerDataSource = require('./ViewPagerDataSource');

const ViewPager = React.createClass({
  mixins: [TimerMixin],

  statics: {
    DataSource: ViewPagerDataSource,
  },

  propTypes: {
    ...View.propTypes,
    dataSource: PropTypes.instanceOf(ViewPagerDataSource).isRequired,
    renderPage: PropTypes.func.isRequired,
    onChangePage: PropTypes.func,
    onPress: PropTypes.func,
    renderPageIndicator: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.bool,
    ]),
    isLoop: PropTypes.bool,
    locked: PropTypes.bool,
    autoPlay: PropTypes.bool,
    animation: PropTypes.func,
    initialPage: PropTypes.number,
    indicatorPosition: PropTypes.oneOf(['up', 'down']),
  },

  fling: false,

  getDefaultProps() {
    return {
      isLoop: false,
      locked: false,
      indicatorPosition: 'down',
      animation: (animate, toValue, gs) =>
        Animated.spring(animate, {
          toValue,
          friction: 10,
          tension: 50,
        }),
    };
  },

  getInitialState() {
    return {
      currentPage: 0,
      viewWidth: 0,
      scrollValue: new Animated.Value(0),
    };
  },

  componentWillMount() {
    this.childIndex = 0;

    const release = (e, gestureState) => {
      const relativeGestureDistance = gestureState.dx / deviceWidth;
      // const lastPageIndex = this.props.children.length - 1,
      const vx = gestureState.vx;
      const relativeSwitchDistance = 0.2;
      const minVelocity = 1e-6;
      let step = 0;

      if (relativeGestureDistance < -relativeSwitchDistance ||
        (relativeGestureDistance < 0 && vx <= -minVelocity)) {
        step = 1;
      } else if (relativeGestureDistance > relativeSwitchDistance ||
        (relativeGestureDistance > 0 && vx >= minVelocity)) {
        step = -1;
      } else if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
        if (this.props.onPress) this.props.onPress(this.state.currentPage);
      }

      if (this.props.hasTouch) this.props.hasTouch(false);

      this.movePage(step, gestureState);
    };

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (e, gestureState) => true,
      // Claim responder if it's a horizontal pan
      onMoveShouldSetPanResponder: (e, gestureState) => {
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          if (/* (gestureState.moveX <= this.props.edgeHitWidth ||
              gestureState.moveX >= deviceWidth - this.props.edgeHitWidth) && */
                this.props.locked !== true && !this.fling) {
            if (this.props.hasTouch) this.props.hasTouch(true);
            return true;
          }
        }
        return false;
      },

      // Touch is released, scroll to the one that you're closest to
      onPanResponderRelease: release,
      onPanResponderTerminate: release,

      // Dragging, move the view with the touch
      onPanResponderMove: (e, gestureState) => {
        const dx = gestureState.dx;
        const offsetX = -dx / this.state.viewWidth + this.childIndex;
        this.state.scrollValue.setValue(offsetX);
      },
    });

    if (this.props.isLoop) {
      this.childIndex = 1;
      this.state.scrollValue.setValue(1);
    }
    if (this.props.initialPage) {
      const initialPage = Number(this.props.initialPage);
      if (initialPage > 0) {
        this.goToPage(initialPage, false);
      }
    }
  },

  componentDidMount() {
    if (this.props.autoPlay) {
      this._startAutoPlay();
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.autoPlay) {
      this._startAutoPlay();
    } else {
      if (this._autoPlayer) {
        this.clearInterval(this._autoPlayer);
        this._autoPlayer = null;
      }
    }

    if (nextProps.dataSource) {
      const maxPage = nextProps.dataSource.getPageCount() - 1;
      const constrainedPage = Math.max(0, Math.min(this.state.currentPage, maxPage));
      this.setState({
        currentPage: constrainedPage,
      });

      if (!nextProps.isLoop) {
        this.state.scrollValue.setValue(constrainedPage > 0 ? 1 : 0);
      }

      this.childIndex = Math.min(this.childIndex, constrainedPage);
      this.fling = false;
    }
  },

  _startAutoPlay() {
    if (!this._autoPlayer) {
      this._autoPlayer = this.setInterval(() => {
        this.movePage(1);
      }, 5000);
    }
  },

  goToPage(pageNumber, animate = true) {
    const pageCount = this.props.dataSource.getPageCount();
    if (pageNumber < 0 || pageNumber >= pageCount) {
      console.error('Invalid page number: ', pageNumber);
      return;
    }

    const step = pageNumber - this.state.currentPage;
    this.movePage(step, null, animate);
  },

  movePage(step, gs, animate = true) {
    const pageCount = this.props.dataSource.getPageCount();
    let pageNumber = this.state.currentPage + step;
    if (this.props.isLoop) {
      pageNumber = (pageNumber + pageCount) % pageCount;
    } else {
      pageNumber = Math.min(Math.max(0, pageNumber), pageCount - 1);
    }

    const moved = pageNumber !== this.state.currentPage;
    const scrollStep = (moved ? step : 0) + this.childIndex;
    const nextChildIdx = (pageNumber > 0 || this.props.isLoop) ? 1 : 0;

    const postChange = () => {
      this.fling = false;
      this.childIndex = nextChildIdx;
      this.state.scrollValue.setValue(nextChildIdx);
      this.setState({
        currentPage: pageNumber,
      });
    };

    if (animate) {
      this.fling = true;
      this.props.animation(this.state.scrollValue, scrollStep, gs)
        .start((event) => {
          if (event.finished) {
            postChange();
          }
          if (moved && this.props.onChangePage) this.props.onChangePage(pageNumber);
        });
    } else {
      postChange();
      if (moved && this.props.onChangePage) this.props.onChangePage(pageNumber);
    }
  },

  getCurrentPage() {
    return this.state.currentPage;
  },

  renderPageIndicator(props) {
    if (this.props.renderPageIndicator === false) {
      return null;
    } else if (this.props.renderPageIndicator) {
      return React.cloneElement(this.props.renderPageIndicator(), props);
    }
    return (
      <View style={styles.indicators}>
        <DefaultViewPageIndicator {...props} />
      </View>
    );
  },

  _getPage(pageIdx: number, loop = false: boolean) {
    const dataSource = this.props.dataSource;
    const pageID = dataSource.pageIdentities[pageIdx];
    return (
      <StaticRenderer
        key={`p_${pageID}${loop ? '_1' : ''}`}
        shouldUpdate={true}
        render={this.props.renderPage.bind(
          null,
          dataSource.getPageData(pageIdx),
          pageID,
          this.state.currentPage
        )}
      />
    );
  },

  render() {
    const dataSource = this.props.dataSource;
    const pageIDs = dataSource.pageIdentities;

    const bodyComponents = [];

    let pagesNum = 0;
    let hasLeft = false;
    const viewWidth = this.state.viewWidth;

    if (pageIDs.length > 0 && viewWidth > 0) {
      // left page
      if (this.state.currentPage > 0) {
        bodyComponents.push(this._getPage(this.state.currentPage - 1));
        pagesNum++;
        hasLeft = true;
      } else if (this.state.currentPage === 0 && this.props.isLoop) {
        bodyComponents.push(this._getPage(pageIDs.length - 1, true));
        pagesNum++;
        hasLeft = true;
      }

      // center page
      bodyComponents.push(this._getPage(this.state.currentPage));
      pagesNum++;

      // right page
      if (this.state.currentPage < pageIDs.length - 1) {
        bodyComponents.push(this._getPage(this.state.currentPage + 1));
        pagesNum++;
      } else if (this.state.currentPage === pageIDs.length - 1 && this.props.isLoop) {
        bodyComponents.push(this._getPage(0, true));
        pagesNum++;
      }
    }

    const sceneContainerStyle = {
      width: viewWidth * pagesNum,
      flex: 1,
      flexDirection: 'row',
    };

    // this.childIndex = hasLeft ? 1 : 0;
    // this.state.scrollValue.setValue(this.childIndex);
    const translateX = this.state.scrollValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -viewWidth],
    });

    const pageIndicatorProps = {
      goToPage: this.goToPage,
      pageCount: pageIDs.length,
      activePage: this.state.currentPage,
      scrollValue: this.state.scrollValue,
      scrollOffset: this.childIndex,
    };

    return (
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          // console.log('ViewPager.onLayout()');
          const viewWidth2 = event.nativeEvent.layout.width;
          if (!viewWidth2 || this.state.viewWidth === viewWidth2) {
            return;
          }
          this.setState({
            currentPage: this.state.currentPage,
            viewWidth: viewWidth2,
          });
        }}
      >
        {this.props.indicatorPosition === 'up'
          && this.renderPageIndicator(pageIndicatorProps)
        }
        <Animated.View
          style={[sceneContainerStyle, { transform: [{ translateX }] }]}
          {...this._panResponder.panHandlers}
        >
          {bodyComponents}
        </Animated.View>

        {this.props.indicatorPosition === 'down'
          && this.renderPageIndicator(pageIndicatorProps)
        }
      </View>
    );
  },
});

const styles = StyleSheet.create({
  indicators: {
    flex: 1,
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
});

module.exports = ViewPager;
