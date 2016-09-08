// @flow
import React, { Component, PropTypes } from 'react';
import {
  Dimensions,
  View,
  PanResponder,
  Animated,
  StyleSheet,
} from 'react-native';
import StaticRenderer from 'react-native/Libraries/Components/StaticRenderer';

import DefaultViewPageIndicator from './DefaultViewPageIndicator';
import ViewPagerDataSource from './ViewPagerDataSource';

type IndicatorPosition = 'down' | 'up';

type Props = {
  dataSource: Object;
  renderPage: Function;
  onChangePage?: ?Function;
  onPress?: ?Function;
  renderPageIndicator?: ?Function;
  isLoop: boolean;
  locked: boolean;
  autoPlay?: ?boolean;
  animation: Function;
  relativeSwitchDistance: number;
  initialPage?: ?number;
  indicatorPosition?: ?IndicatorPosition;
  hasTouch?: ?Function;
};

type State = {
  currentPage: number;
  viewWidth: number;
  scrollValue: Object;
};

type DefaultProps = {
  isLoop: boolean;
  locked: boolean;
  relativeSwitchDistance: number;
  indicatorPosition: IndicatorPosition;
  animation: Function;
};

class ViewPager extends Component<DefaultProps, Props, State> {
  static DataSource = ViewPagerDataSource;

  props: Props;
  autoPlayer: ?number;
  panResponder: Object;
  childIndex: number;
  fling: boolean;

  getPage: Function;
  startAutoPlay: Function;
  goToPage: Function;
  movePage: Function;
  getCurrentPage: Function;


  static propTypes = {
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
    relativeSwitchDistance: PropTypes.number,
    initialPage: PropTypes.number,
    indicatorPosition: PropTypes.oneOf(['up', 'down']),
    hasTouch: PropTypes.func,
  };

  static defaultProps: DefaultProps = {
    isLoop: false,
    locked: false,
    relativeSwitchDistance: 0.5,
    indicatorPosition: 'down',
    animation: (animate, toValue) =>
      Animated.spring(animate, {
        toValue,
        friction: 10,
        tension: 50,
      }),
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      currentPage: 0,
      viewWidth: 0,
      scrollValue: new Animated.Value(0),
    };

    this.getPage = this.getPage.bind(this);
    this.startAutoPlay = this.startAutoPlay.bind(this);
    this.goToPage = this.goToPage.bind(this);
    this.movePage = this.movePage.bind(this);
    this.getCurrentPage = this.getCurrentPage.bind(this);
    this.renderPageIndicator = this.renderPageIndicator.bind(this);
    this.getPage = this.getPage.bind(this);
  }

  state: State;

  componentWillMount() {
    this.childIndex = 0;
    const deviceWidth = Dimensions.get('window').width;

    // Handles the page drag release
    const release = (e, gestureState) => {
      const relativeGestureDistance = gestureState.dx / deviceWidth;
      // const lastPageIndex = this.props.children.length - 1,
      const { vx } = gestureState;
      const { relativeSwitchDistance } = this.props;
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

    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (/* e, gestureState */) => true,
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
  }

  componentDidMount() {
    if (this.props.autoPlay) this.startAutoPlay();
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.autoPlay) {
      this.startAutoPlay();
    } else {
      if (this.autoPlayer) {
        clearInterval(this.autoPlayer);
        this.autoPlayer = null;
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
  }

  componentWillUnmount() {
    if (!!this.autoPlayer) {
      clearInterval(this.autoPlayer);
    }
  }

  startAutoPlay(): void {
    if (!this.autoPlayer) {
      this.autoPlayer = setInterval(() => {
        this.movePage(1);
      }, 5000);
    }
  }

  goToPage(pageNumber: number, animate: boolean = true): void {
    const pageCount = this.props.dataSource.getPageCount();
    if (pageNumber < 0 || pageNumber >= pageCount) {
      console.error('Invalid page number: ', pageNumber);
      return;
    }

    const step = pageNumber - this.state.currentPage;
    console.log('goToPage', { pageNumber, animate, step });
    this.movePage(step, null, animate);
  }

  /**
   * Automatically moves the page to step
   * @param step the number of pages where to move, minus indicating backwards direction
   * @param gs is an optional gestureState if the move was triggered by gesture
   * @param animate boolean whether to animate the transition
   */
  movePage(step: number, gs: ?Object, animate: boolean = true): void {
    const pageCount: number = this.props.dataSource.getPageCount();
    const { currentPage } = this.state;
    let pageNumber: number = currentPage + step;
    const { isLoop } = this.props;

    if (isLoop) {
      pageNumber = (pageNumber + pageCount) % pageCount;
    } else {
      pageNumber = Math.min(Math.max(0, pageNumber), pageCount - 1);
    }

    const moved: boolean = pageNumber !== this.state.currentPage;
    const scrollStep: number = (moved ? step : 0) + this.childIndex;
    const nextChildIndex: number = (pageNumber > 0 || isLoop) ? 1 : 0;

    const postChange: Function = () => {
      this.fling = false;
      this.childIndex = nextChildIndex;
      this.state.scrollValue.setValue(nextChildIndex);
      this.setState({
        currentPage: pageNumber,
      });
    };

    if (animate) {
      this.fling = true;
      this.props.animation(this.state.scrollValue, scrollStep, gs)
        .start((event) => {
          if (event.finished) {
            console.log('anim finished');
            postChange();
            if (moved && this.props.onChangePage) this.props.onChangePage(pageNumber);
          }
        });
    } else {
      postChange();
      if (moved && this.props.onChangePage) this.props.onChangePage(pageNumber);
    }
  }

  /**
   * Returns the current page number
   */
  getCurrentPage(): number {
    return this.state.currentPage;
  }

  getPage(pageIndex: number, loop: boolean = false): React.Element<*> {
    const dataSource = this.props.dataSource;
    const pageID = dataSource.pageIdentities[pageIndex];

    const renderWithProps = this.props.renderPage.bind(
      null,
      dataSource.getPageData(pageIndex),
      pageID,
      this.state.currentPage
    );

    return (
      <StaticRenderer
        key={`p_${pageID}${loop ? '_1' : ''}`}
        shouldUpdate={true}
        render={renderWithProps}
      />
    );
  }

  /**
   * Renders the current page component
   */
  renderPageIndicator: Function;
  renderPageIndicator(props: Object): ?React.Element<*> {
    // Check if custom page indicator or no indicator
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
  }

  render() {
    const { dataSource } = this.props;
    const pageIDs: Array<any> = dataSource.pageIdentities;

    const bodyComponents: Array<React.Element<*>> = [];

    let pagesNum: number = 0;
    const viewWidth: number = this.state.viewWidth;

    if (pageIDs.length > 0 && viewWidth > 0) {
      // left page
      if (this.state.currentPage > 0) {
        bodyComponents.push(this.getPage(this.state.currentPage - 1));
        pagesNum++;
      } else if (this.state.currentPage === 0 && this.props.isLoop) {
        bodyComponents.push(this.getPage(pageIDs.length - 1, true));
        pagesNum++;
      }

      // center page
      bodyComponents.push(this.getPage(this.state.currentPage));
      pagesNum++;

      // right page
      if (this.state.currentPage < pageIDs.length - 1) {
        bodyComponents.push(this.getPage(this.state.currentPage + 1));
        pagesNum++;
      } else if (this.state.currentPage === pageIDs.length - 1 && this.props.isLoop) {
        bodyComponents.push(this.getPage(0, true));
        pagesNum++;
      }
    }

    const sceneContainerStyle: Object = {
      width: viewWidth * pagesNum,
      flex: 1,
      flexDirection: 'row',
    };

    // this.childIndex = hasLeft ? 1 : 0;
    // this.state.scrollValue.setValue(this.childIndex);
    const translateX: number = this.state.scrollValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -viewWidth],
    });

    const pageIndicatorProps: Object = {
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
          {...this.panResponder.panHandlers}
        >
          {bodyComponents}
        </Animated.View>

        {this.props.indicatorPosition === 'down'
          && this.renderPageIndicator(pageIndicatorProps)
        }
      </View>
    );
  }
}

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

export default ViewPager;
