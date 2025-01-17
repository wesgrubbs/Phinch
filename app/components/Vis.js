import React, { Component } from 'react';
import { Link, Redirect } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';

import Spotlight from "rc-spotlight";
import 'antd/dist/antd.css';
import { Tooltip } from 'antd';
import ReactTooltip from 'react-tooltip';
import SpotlightWithToolTip from './SpotlightWithToolTip';

import _sortBy from 'lodash.sortby';
import _debounce from 'lodash.debounce';
import _cloneDeep from 'lodash.clonedeep';
import { nest } from 'd3-collection';
import { scaleLinear, scaleOrdinal } from 'd3-scale';

import logo from 'images/phinch.svg';
import back from 'images/back.svg';
import save from 'images/save.svg';
import exportButton from 'images/export.svg';
import dropDownArrow from 'images/dropDownArrow.svg';

import needHelp from 'images/needHelpDefault.png';
import needHelpHover from 'images/needHelpHover.png';
import closeHelp from 'images/closeHelp.png';

import help1 from 'images/help1.svg';
import help1Hover from 'images/help1Hover.svg';
import help2 from 'images/help2.svg';
import help2Hover from 'images/help2Hover.svg';
import help3 from 'images/help3.svg';
import help3Hover from 'images/help3Hover.svg';
import help4 from 'images/help4.svg';
import help4Hover from 'images/help4Hover.svg';
import help5 from 'images/help5.svg';
import help5Hover from 'images/help5Hover.svg';
import help6 from 'images/help6.svg';
import help6Hover from 'images/help6Hover.svg';
import help7 from 'images/help7.svg';
import help7Hover from 'images/help7Hover.svg';
import help8 from 'images/help8.svg';
import help8Hover from 'images/help8Hover.svg';

import {
  updateFilters,
  removeRows,
  restoreRows,
  visSortBy,
  countObservations
} from '../filterfunctions';
import { setProjectFilters, getProjectFilters } from '../projects';
import handleExportButton from '../export';
import DataContainer from '../datacontainer';
import { pageView } from '../analytics';
import palette from '../palette';

import Search from './Search';
import SideMenu from './SideMenu';
import Sequence from './Sequence';
import StackedBarRow from './StackedBarRow';
import StackedBarTicks from './StackedBarTicks';
import StackedBarTooltip from './StackedBarTooltip';
import StackedBarsSVG from './StackedBarsSVG';
import FilterChart from './FilterChart';
import Summary from './Summary';
import Modal from './Modal';
import Sankey from './Sankey/'
import styles from './Vis.css';
import gstyle from './general.css';
import classNames from 'classnames';

import { style } from 'd3';

export default class Vis extends Component {
  constructor(props) {
    super(props);
    // console.log(props)
    pageView('/vis');

    this.state = {
      summary: DataContainer.getSummary(),
      names: [],
      data: [],
      observations: 0,
      preData: [],
      deleted: [],
      tags: [],
      rowTags: {},
      filters: {},
      width: window.innerWidth,
      height: window.innerHeight,
      redirect: null,
      level: 1,
      highlightedDatum: null,
      selectedAttribute: '',
      showTooltip: false,
      showTags: false,
      mode: 'percent',
      labelKey: 'phinchName',
      sortReverse: true,
      sortKey: 'biomid',
      showRightSidebar: false,
      showLeftSidebar: false,
      showEmptyAttrs: true,
      result: null,
      renderSVG: false,
      dialogVisible: false,
      sankeyColors: 'right',
      helpCounter: 0,
      helpButton: needHelp,
      overrideRightSidebar: null
    };

    this._inputs = {};

    this.initdata = DataContainer.getFilteredData();
    this.attributes = DataContainer.getAttributes();
    this.levels = DataContainer.getLevels() || [];

    // move to config or own file
    this.menuItems = [
      {
        id: 'save',
        name: 'Save',
        action: () => {
          this.save(this.setResult);
        },
        icon: <img src={save} alt="save" />,
      },
      {
        id: 'filter',
        name: 'Back',
        action: () => {
          this.save(() => (
            this.setState({ redirect: '/Filter' })));
        },
        icon: <img src={back} alt="back" />,
      },
      {
        id: 'export',
        name: 'Export SVG',
        action: () => {
          this.setState({ renderSVG: true });
        },
        icon: <img src={exportButton} alt="export" />,
      }
    ];

    this.filters = {};

    this.tooltip = {
      timer: null,
      duration: 1500,
    };

    // Move this to data
    const tagColors = [
      '#ff4a14',
      '#ffc400',
      '#00adff',
      '#2bfec3',
    ];
    this.state.tags = [
      {
        id: 'none',
        color: null,
        name: 'No Tags',
        selected: true,
      }, ...tagColors.map((c, i) => ({
        id: `tag-${i}`,
        name: `Tag ${i}`,
        color: c,
        selected: true,
      }))
    ];

    this.readsBySequence = {};
    this.sequences = [];
    this.topSequences = [];

    this.metrics = {
      padding: 16,
      lineHeight: 20,
      sequenceRowHeight: 24,
      barContainerHeight: 65,
      barHeight: 56,
      attrBarContainerHeight: 40,
      attrBarHeight: 28,
      miniBarContainerHeight: 8,
      miniBarHeight: 6,
      height: 600,
      hideWidth: 20,
      idWidth: 32,
      nameWidth: 140,
      barInfoWidth: 188,
      heightOffset: 130, // 158,
      leftSidebar: 27,
      left: {
        min: 27,
        max: 121,
      },
      rightSidebar: 236,
      debounce: 350,
    };

    this.metrics.nonbarWidth = (this.metrics.padding * 3) + (this.metrics.barInfoWidth);
    this.metrics.chartWidth = this.state.width
      - (this.metrics.leftSidebar + this.metrics.nonbarWidth);
    this.metrics.chartHeight = this.state.height - this.metrics.heightOffset;

    this.scales = {
      x: scaleLinear(),
      c: scaleOrdinal().range(palette),
    };

    this.totalDataReads = 0;

    if (Object.keys(this.initdata).length === 0) {
      this.state.redirect = '/';
    } else {
      // Break this whole chunk into a function or something
      //
      this.init = getProjectFilters(this.state.summary.path, this.state.summary.dataKey, 'vis');
      //
      this.state.names = this.init.names;
      // console.log('initial level', this.state.level)
      this.state.level = (this.init.level !== undefined) ? this.init.level : this.state.level;
      // console.log(this.init, this.state.level)
      this.filters = this.init.filters ? this.init.filters : {};
      this.state.deleted = this.init.deleted ? this.init.deleted : [];
      this.state.tags = this.init.tags ? this.init.tags : this.state.tags;
      //
      // Can probably lose this for release
      this.state.tags = this.state.tags.map(t => {
        if (t.id === 'none') {
          t.name = 'No Tags';
        }
        return t;
      });
      //
      //this is to allow the programmer to track if all tags are unselected or or least one
      //is for styling purposes. Likely a better way to do this using data but the function of
      //all state variables need to be identified first which will take time.
      // this.state.tagTracker = this.state.tags.map(t => {
      //   if (t.selected === 'true') {
      //     return true;
      //     break;
      //   }
      //   return false;
      // });
      //
      this.state.rowTags = this.init.rowTags ? this.init.rowTags : this.state.rowTags;
      this.state.selectedAttribute = this.init.selectedAttribute ? (
        this.init.selectedAttribute
      ) : this.state.selectedAttribute;
      this.state.showEmptyAttrs = this.init.showEmptyAttrs === undefined
        ? true : this.init.showEmptyAttrs;
      //
      // Ugly...
      this.state.showLeftSidebar = (this.init.showLeftSidebar !== undefined) ? (
        this.init.showLeftSidebar
      ) : this.state.showLeftSidebar;
      this.metrics.leftSidebar = this.state.showLeftSidebar ?
        this.metrics.left.max : this.metrics.left.min;
      //
      if (this.init.sort) {
        this.state.mode = this.init.sort.mode === undefined
          ? this.state.mode
          : this.init.sort.mode;
        this.state.labelKey = this.init.sort.labelKey === undefined
          ? this.state.labelKey
          : this.init.sort.labelKey;
        this.state.sortReverse = this.init.sort.sortReverse === undefined
          ? this.state.sortReverse
          : this.init.sort.sortReverse;
        this.state.sortKey = this.init.sort.sortKey === undefined
          ? this.state.sortKey
          : this.init.sort.sortKey;
      }
      //
    }

    this.onSuggestionHighlighted = this.onSuggestionHighlighted.bind(this);
    this.onSuggestionSelected = this.onSuggestionSelected.bind(this);
    this.onValueCleared = this.onValueCleared.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);
    this.updatePhinchName = this.updatePhinchName.bind(this);
    this.toggleEmptyAttrs = this.toggleEmptyAttrs.bind(this);
    this.applyFilters = this.applyFilters.bind(this);
    this.removeFilter = this.removeFilter.bind(this);
    this.toggleMenu = this.toggleMenu.bind(this);
    this.toggleRightMenu = this.toggleRightMenu.bind(this);
    this.toggleLog = this.toggleLog.bind(this);
    this.countUpHelp = this.countUpHelp.bind(this);
    this._isMounted = false
  }

  componentDidMount() {
    this._isMounted = true
    window.addEventListener('resize', this.updateDimensions);
    if (this.initdata) {
      this.formatTaxonomyData(this.initdata, this.state.level, (data) => {
        this.setState({ data, preData: data }, () => {
          this.updateAttributeValues(this.state.selectedAttribute, this.state.data);
          this.setLevel(this.state.level);
        });
      });
    }
    window.addEventListener('click', this.countUpHelp);

  }

  componentDidUpdate() {
    if (this.state.renderSVG && !this.state.dialogVisible) {
      this.setDialogVisible();
      // console.log(this.state.summary.path)
      // console.log(this._svg)
      handleExportButton(_cloneDeep(this.state.summary.path), this._svg, this.exportComplete, this._visType);
    }
    if (this.state.helpCounter === 6 && this._visType === 'stackedbar' && Object.keys(this.state.filters).length === 0) {
      this._clickDatum(this.sequences[0]);
      this.setState({ datumClickedViaHelp: this.sequences[0] });
    }
    if (this.state.helpCounter !== 6 && this._visType === 'stackedbar' && this.state.datumClickedViaHelp) {
      this.removeFilter(this.state.datumClickedViaHelp.name);
      this.setState({ datumClickedViaHelp: null });

    }
    if (this.state.helpCounter === 7 && this._visType === 'stackedbar' && !this.state.highlightedDatum && !this.state.highlightedDatumFromHelp) {
      this.setState({
        highlightedDatum: {
          datum: this.state.data[0].sequences[0],
          sample: this.state.data[0],
          position: {
            x: 400, y: 250
          }
        },
        showTooltip: true,
        highlightedDatumFromHelp: true,
      })
    } else if (this.state.helpCounter !== 7 && this._visType === 'stackedbar' && this.state.highlightedDatum && this.state.highlightedDatumFromHelp) {
      this.setState({
        highlightedDatum: null,
        showTooltip: false,
        highlightedDatumFromHelp: false,
      })
    }
    if (this.state.helpCounter === 8 && this._visType === 'stackedbar' && !this.state.selectedAttributeFromHelp) {
      const selectedAttribute = Object.keys(this.attributes)[0];
      this.updateAttributeValues(selectedAttribute, this.state.data);

      this.setState({
        selectedAttribute,
        selectedAttributeFromHelp: true,

      })
    } else if (this.state.helpCounter !== 8 && this._visType === 'stackedbar' && this.state.selectedAttributeFromHelp) {
      this.setState({
        selectedAttribute: '',
        selectedAttributeFromHelp: false,
      })
    }
  }

  componentWillUnmount() {
    this._isMounted = false
    clearTimeout(this.tooltip.handle);
    clearTimeout(this.timeout);
    window.removeEventListener('resize', this.updateDimensions);
    window.removeEventListener('click', this.countUpHelp);

  }
  countUpHelp() {

    if(this.state.helpCounter > 0) {
      const currCount = this.state.helpCounter;
      const newCount = currCount + 1;
      // 6 for sankey, 8 for bargraph
      const maxCount = this._visType === 'sankey' ? 6 : 9;
      newCount > maxCount ? this.setState({ helpCounter: 2, }) : this.setState({ helpCounter: newCount, });
    }
  }

  exportComplete = () => {
    this.setState({ renderSVG: false, dialogVisible: false });
  }

  setDialogVisible = () => {
    this.setState({ dialogVisible: true });
  }

  save = (callback) => {
    const viewMetadata = {
      type: 'vis',
      level: this.state.level,
      filters: this.filters,
      deleted: this.state.deleted,
      sort: {
        mode: this.state.mode,
        labelKey: this.state.labelKey,
        sortReverse: this.state.sortReverse,
        sortKey: this.state.sortKey,
      },
      tags: this.state.tags,
      rowTags: this.state.rowTags,
      showLeftSidebar: this.state.showLeftSidebar,
      selectedAttribute: this.state.selectedAttribute,
      showEmptyAttrs: this.state.showEmptyAttrs,
    };
    setProjectFilters(
      this.state.summary.path,
      this.state.summary.dataKey,
      this.state.names,
      viewMetadata,
      (value) => {
        callback(value);
      },
    );
  };

  setResult = (value) => {
    const result = value;
    this.timeout = setTimeout(() => {
      this.clearResult();
    }, 3000);
    this.setState({ result });
  }

  clearResult = () => {
    const result = null;
    this.setState({ result });
  }

  _toggleTag = (datum, tag, isRemoved) => {
    if (datum.tags[tag.id]) {
      delete datum.tags[tag.id];
    } else {
      datum.tags[tag.id] = tag;
    }
    const rowTags = _cloneDeep(this.state.rowTags);
    rowTags[datum.sampleName] = datum.tags;
    // ugly
    if (isRemoved) {
      const deleted = this.state.deleted.map((d) => {
        if (d.sampleName === datum.sampleName) {
          d.tags = datum.tags;
        }
        return d;
      });
      this.setState({ deleted }, () => {
        this.save(this.setResult);
      });
    } else {
      const data = this.state.data.map((d) => {
        if (d.sampleName === datum.sampleName) {
          d.tags = datum.tags;
        }
        return d;
      });
      this.setState({ data }, () => {
        this.save(this.setResult);
      });
    }
  }

  _toggleTags = () => {
    const showTags = !this.state.showTags;
    this.setState({ showTags });
  }

  _hoverDatum = (datum, sample, position) => {
    if (datum == null) {
      clearTimeout(this.tooltip.handle);
      this.setState({
        highlightedDatum: null,
        showTooltip: false,
      });
    } else {
      if (!this.state.showTooltip) {
        this.tooltip.handle = setTimeout(() => {
          this.setState({ showTooltip: true });
        }, this.tooltip.duration);
      }
      this.setState({ highlightedDatum: { datum, sample, position } });
    }
  }

  _clickDatum = (datum) => {
    if (!Object.prototype.hasOwnProperty.call(this.filters, this.state.level)) {
      this.filters[this.state.level] = {};
    }
    const filters = _cloneDeep(this.state.filters);
    if (!Object.prototype.hasOwnProperty.call(this.filters[this.state.level], datum.name)) {
      const sequences = [];
      this.state.preData.forEach(d => {
        d.sequences.forEach(s => {
          if (datum.name === s.name && s.reads > 0) {
            sequences.push(s);
          }
        });
      });
      const totalReads = sequences.map(s => s.reads).reduce((s, v) => s + v);
      const values = _sortBy(sequences, (s) => s.reads).map((s, i) => ({
        index: i,
        value: s.reads,
        count: (s.reads === 0) ? 1 : s.reads,
        percent: s.reads / totalReads,
      }));
      this.filters[this.state.level][datum.name] = {
        key: datum.name,
        values,
        unit: '',
        range: {
          min: values[0],
          max: values[values.length - 1],
        },
        log: true,
        expanded: true,
      };
      filters[datum.name] = this.filters[this.state.level][datum.name];
    }
    const showRightSidebar = Object.keys(filters).length > 0;
    this.updateChartWidth(showRightSidebar);
    this.setState({ filters, showRightSidebar }, () => {
      this.topSequences = this.renderTopSequences();
      this.save(this.setResult);
    });
  }

  toggleLog(name) {
    const filters = _cloneDeep(this.state.filters);
    filters[name].log = !filters[name].log;
    this.filters[this.state.level] = filters;
    this.setState({ filters }, () => {
      this.save(this.setResult);
    });
  }

  removeFilter(name) {
    const filters = _cloneDeep(this.state.filters);
    delete filters[name];
    this.filters[this.state.level] = filters;
    const showRightSidebar = Object.keys(filters).length > 0;
    this.updateChartWidth(showRightSidebar);
    const data = this.filterData(filters, this.state.tags, this.state.preData, this.state.deleted);
    const observations = countObservations(data);
    this.updateAttributeValues(this.state.selectedAttribute, data);
    this.setState({
      data, observations, filters, showRightSidebar
    }, () => {
      this.topSequences = this.renderTopSequences();
      this.save(this.setResult);
    });
  }

  updateChartWidth(_showRightSidebar) {
    const showRightSidebar = (_showRightSidebar || this.state.overrideRightSidebar === 'open') && !(_showRightSidebar && this.state.overrideRightSidebar === 'close')
    // console.log('update chart width', { _showRightSidebar, showRightSidebar, overrideRightSidebar: this.state.overrideRightSidebar })
    if (showRightSidebar) {
      this.metrics.chartWidth = window.innerWidth
        - (this.metrics.leftSidebar + this.metrics.rightSidebar + this.metrics.nonbarWidth);
    } else {
      this.metrics.chartWidth = window.innerWidth
        - (this.metrics.leftSidebar + this.metrics.nonbarWidth );
    }
    if (this._isMounted) {
      this.setState({ chartWidth: this.metrics.chartWidth })
    }
  }

  updateDimensions() {
    this.updateChartWidth(this.state.showRightSidebar);
    this.metrics.chartHeight = window.innerHeight - this.metrics.heightOffset;
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  setLevel(level) {
    if (!Object.prototype.hasOwnProperty.call(this.filters, level)) {
      this.filters[level] = {};
    }
    const filters = this.filters[level];
    const showRightSidebar = Object.keys(filters).length > 0;
    this.updateChartWidth(showRightSidebar);
    this.updateTaxonomyData(this.state.preData, level, true, (preData) => {
      this.updateTaxonomyData(this.state.deleted, level, false, (deleted) => {
        const data = this.filterData(filters, this.state.tags, preData, deleted);
        const observations = countObservations(data);
        this.updateAttributeValues(this.state.selectedAttribute, data);
        this.setState({
          level, data, observations, preData, deleted, filters, showRightSidebar
        }, () => {
          this.topSequences = this.renderTopSequences();
          this.save(this.setResult);
        });
      });
    });
  }

  // data.data schema: [row(observations), column(samples), count]
  // Move to data container?
  formatTaxonomyData(data, level, callback) {
    let totalDataReads = 0;
    const indata = data.columns.map(c => {
      const matches = data.data
        .filter(d => d[1] === c.metadata.phinchID)
        .map(d => {
          const row = data.rows[d[0]];
          return {
            id: row.id,
            taxonomy: row.metadata.taxonomy,
            count: d[2]
          };
        });
      totalDataReads += c.reads;
      let phinchName = c.phinchName.toString();
      if (this.state.names[c.sampleName]) {
        phinchName = this.state.names[c.sampleName];
      }
      const tags = this.state.rowTags[c.sampleName] ? this.state.rowTags[c.sampleName] : {};
      Object.keys(tags).forEach(k => {
        const [tag] = this.state.tags.filter(t => t.id === k);
        tags[k] = tag;
      });
      const [dateAttribute] = Object.keys(this.attributes)
        .map(k => this.attributes[k])
        .filter(a => a.type === 'date');
      let collectionDate = '';
      if (dateAttribute) {
        collectionDate = c.metadata[dateAttribute.key] ? (
          new Date(c.metadata[dateAttribute.key]).toLocaleString().split(', ')[0]
        ) : '';
      }
      return {
        id: c.id,
        biomid: c.biomid,
        phinchID: c.metadata.phinchID,
        order: c.order,
        sampleName: c.sampleName,
        phinchName,
        observations: c.observations,
        reads: c.reads,
        sequences: [],
        date: collectionDate,
        tags,
        matches,
      };
    });
    this.totalDataReads = totalDataReads;
    this.updateTaxonomyData(indata, level, true, (formatedData) => {
      callback(formatedData);
    });
  }

  updateTaxonomyData(data, level, updateSequences, callback) {
    if (updateSequences) {
      this.readsBySequence = {};
    }
    const taxonomyData = data.map(d => {
      d.sequences = nest()
        .key(s => s.taxonomy.slice(0, level + 1))
        .entries(d.matches)
        .map(s => {
          const reads = s.values.map(v => v.count).reduce((a, v) => a + v);
          if (updateSequences) {
            if (s.key in this.readsBySequence) {
              this.readsBySequence[s.key] += reads;
            } else {
              this.readsBySequence[s.key] = reads;
            }
          }
          return {
            name: s.key,
            taxonomy: s.values[0].taxonomy,
            reads,
          };
        });
      return d;
    });
    if (updateSequences) {
      this.sequences = this.updateSequences();
    }
    callback(taxonomyData);
  }

  filterData(filters, tags, preData, deleted) {
    const deletedSamples = deleted.map(d => d.sampleName);
    const samples = preData.filter(s => {
      let include = true;
      if (deletedSamples.includes(s.sampleName)) {
        include = false;
      }
      Object.keys(filters).forEach((k) => {
        const [sequence] = s.sequences.filter(d => (d.name === k));
        if (sequence) {
          const value = sequence.reads;
          if (value < filters[k].range.min.value || value > filters[k].range.max.value) {
            include = false;
          }
        }
      });
      const showNoneTags = (tags.filter(t => t.selected && t.id === 'none').length > 0);
      const countTags = Object.keys(s.tags).length;
      const countSelectedTags = Object.keys(s.tags).filter(t => !s.tags[t].selected).length;
      if (
        (!showNoneTags && countTags === 0)
          ||
        (countTags > 0 && countTags === countSelectedTags)
      ) {
        include = false;
      }
      return include;
    });
    return visSortBy(samples, this.state.sortReverse, this.state.sortKey);
  }

  applyFilters(filters) {
    const data = this.filterData(filters, this.state.tags, this.state.preData, this.state.deleted);
    const observations = countObservations(data);
    this.updateAttributeValues(this.state.selectedAttribute, data);
    this.setState({ filters, data, observations }, _debounce(() => {
      this.save(this.setResult);
    }), this.metrics.debounce, { leading: false, trailing: true });
  }

  renderSearch() {
    return <Search
      options={this.sequences}
      onValueCleared={this.onValueCleared}
      onSuggestionSelected={this.onSuggestionSelected}
      onSuggestionHighlighted={this.onSuggestionHighlighted}
    />
  }
  renderFilters() {
    let segments = null
    if (Object.keys(this.state.filters).length && this.state.overrideRightSidebar !== 'close') {
      segments = Object.keys(this.state.filters).map(k => (
        <SpotlightWithToolTip
          isActive={this.state.helpCounter === 6 && this._visType === 'stackedbar'}
          toolTipPlacement= "left"
          toolTipTitle={
              <div>
                After clicking a search result, a side bar will appear that shows the distribution of observations for each chosen search result. A mini bar chart for that search result will also appear underneath each main graph.
                <br /><br />
                On the side bar, the circles and slider bar underneath each distribution graph can be used as a further filtering mechanisms for rows displayed in the taxonomy bar chart. Only samples meeting the sidebar filtering criteria will remain visible in the main visualization window.
                The graphs are visualized based on users’ setting on data filtering page, which means the actions taken previously will affect the visualisation shown here.
                The top sequences box below shows the most abundant observations in your TOTAL dataset, with numerical values calculated after filter page settings have been applied.
                <br /><br />
                To remove the graph on the sidebar, simply click the “X” button on the upper right hand side of the sidebar detail. This will also cause the corresponding mini-bar chart to be removed in the main window.
              </div>
          }
          style={{ boxShadow: 'rgba(255, 255, 255, 0.4) 0 0 10px 3px',
            pointerEvents: 'none',
            padding: '0.25rem 0.5rem 0px',
            margin: '0.25rem 0.5rem 0px',
          }}

        >
          <div
            key={k}
            style={{
              borderBottom: '1px solid #000',
              margin: this.state.helpCounter === 6 ? '0.25rem 0.5rem 0px' : '0.5rem 1rem 0',
            }}
          >
            <FilterChart
              name={k}
              showScale
              showCircle
              fill={this.scales.c(k)}
              handle={this.scales.c(k)}
              data={this.state.filters[k]}
              width={this.metrics.rightSidebar - (this.metrics.padding * 4)}
              height={this.metrics.rightSidebar / 4}
              filters={this.state.filters}
              update={updateFilters}
              remove={this.removeFilter}
              toggleLog={this.toggleLog}
              callback={this.applyFilters}
              noMargin
              simpleHandles
            />
          </div>
        </SpotlightWithToolTip>
      ));
    }
    const rightSidebarOpen = (this.state.showRightSidebar || this.state.overrideRightSidebar === 'open') && !(this.state.showRightSidebar && this.state.overrideRightSidebar === 'close')
    return (
      <div className={classNames(gstyle.panel, gstyle.noscrollbar, styles.rightPanelContainer, { [styles.rightSidebarOpen]: rightSidebarOpen})}
        style={{ zIndex: this.state.helpCounter === 6 && this._visType === 'stackedbar' ? 100000 : null}}
      >
        <div className={styles.buttonContainer}>
          <div className={styles.toggleSquare} />

          <div
            role="button"
            tabIndex={0}
            className={`
              ${styles.menuToggle}
              ${this.state.showRightSidebar || (this.state.overrideRightSidebar === 'open'  && this.state.overrideRightSidebar !== 'close') ? styles.closeMenu : styles.openMenu}`}
            onClick={this.toggleRightMenu}
            style={{
              display: this.state.helpCounter === 6 && this._visType === 'stackedbar' ? 'none' : null,
            }}
          />
        </div>
        {segments ?
          <div
            className={`${gstyle.panel} ${gstyle.darkbgscrollbar}`}
            style={{
              borderTop: '1px solid #262626',
              position: 'fixed',
              width: this.state.showRightSidebar || (this.state.overrideRightSidebar === 'open'  && this.state.overrideRightSidebar !== 'close') ? this.metrics.rightSidebar + 10 : 0,
              height: this.metrics.chartHeight + (this.metrics.lineHeight * 2),
              background: "#2D2F31",
            }}
          >
            {segments}
          </div>
        : null}
      </div>

    );
  }

  toggleMenu() {
    const showLeftSidebar = !this.state.showLeftSidebar;
    this.metrics.leftSidebar = showLeftSidebar ?
      this.metrics.left.max : this.metrics.left.min;
    this.updateChartWidth(this.state.showRightSidebar);
    this.setState({ showLeftSidebar }, () => {
      this.save(this.setResult);
    });
  }
  toggleRightMenu() {
    let newValue = this.state.showRightSidebar ? 'close' : 'open'
    if (newValue === this.state.overrideRightSidebar) {
      newValue = null
    }

    this.setState({
      overrideRightSidebar: newValue
    }, () => {
      this.updateChartWidth(this.state.showRightSidebar);
    })

  }

  onSuggestionSelected(e, { suggestion }) {
    const highlightedDatum = null;
    const showTooltip = false;
    this.setState({ highlightedDatum, showTooltip }, () => {
      this._clickDatum(suggestion);
    });
  }

  onSuggestionHighlighted({ suggestion }) {
    if (suggestion === null) {
      this.setState({
        highlightedDatum: null,
      })
      return;
    }
    const highlightedDatum = {
      datum: suggestion,
      sample: null,
      position: null,
    };
    const showTooltip = false;
    this.setState({
      highlightedDatum,
      showTooltip
    })
  }

  onValueCleared() {
    const highlightedDatum = null;
    const showTooltip = false;
    this.setState({ highlightedDatum, showTooltip }, () => {
      this.save(this.setResult);
    });
  }

  updatePhinchName(e, r, isRemoved) {
    // ugly - similar to function in Filter.js
    const names = _cloneDeep(this.state.names);
    if (isRemoved) {
      const deleted = this.state.deleted.map((d) => {
        if (d.sampleName === r.sampleName) {
          d.phinchName = e.target.value;
        }
        names[d.sampleName] = d.phinchName;
        return d;
      });
      this.setState({ deleted }, _debounce(() => {
        this.save(this.setResult);
      }), this.metrics.debounce, { leading: false, trailing: true });
    } else {
      const data = this.state.data.map((d) => {
        if (d.sampleName === r.sampleName) {
          d.phinchName = e.target.value;
        }
        names[d.sampleName] = d.phinchName;
        return d;
      });
      this.setState({ data, names }, _debounce(() => {
        this.save(this.setResult);
      }), this.metrics.debounce, { leading: false, trailing: true });
    }
  }

  updateTagName(event, tag) {
    const tags = this.state.tags.map(t => {
      if (t.id === tag.id) {
        t.name = event.target.value;
      }
      return t;
    });
    this.setState({ tags }, _debounce(() => {
      this.save(this.setResult);
    }), this.metrics.debounce, { leading: false, trailing: true });
  }

  filterByTag(event, tag) {
    const tags = this.state.tags.map(t => {
      if (tag.id === t.id) {
        t.selected = event.target.checked;
      }
      return t;
    });
    const data = this.filterData(this.state.filters, tags, this.state.preData, this.state.deleted);
    const observations = countObservations(data);
    this.updateAttributeValues(this.state.selectedAttribute, data);
    this.setState({ tags, data, observations }, () => {
      this.save(this.setResult);
    });
  }

  toggleEmptyAttrs() {
    const showEmptyAttrs = !this.state.showEmptyAttrs;
    this.setState({ showEmptyAttrs }, () => {
      this.updateAttributeValues(this.state.selectedAttribute, this.state.data);
      this.save(this.setResult);
    });
  }

  stack = (datum, index, yOffset, removed) => (
    <StackedBarRow
      key={datum.id}
      data={datum}
      index={index}
      zIndex={this.state.data.length - index}
      isLast={index === this.state.data.length - 1}
      yOffset={yOffset}
      labelKey={this.state.labelKey}
      filters={this.state.filters}
      metrics={this.metrics}
      scales={this.scales}
      tags={this.state.tags.filter(t => t.id !== 'none')}
      toggleTag={this._toggleTag}
      isPercent={(this.state.mode === 'percent')}
      isRemoved={removed}
      highlightedDatum={this.state.highlightedDatum}
      removeDatum={() => { removeRows(this, [datum]); }}
      restoreDatum={() => { restoreRows(this, [datum]); }}
      hoverDatum={this._hoverDatum}
      clickDatum={this._clickDatum}
      updatePhinchName={this.updatePhinchName}
      renderSVG={this.state.renderSVG}
    />
  );

  stackRow = ({ index, style }) => this.stack(this.state.data[index], index, style.top, false)

  attr = (datum, index, yOffset) => (
    <StackedBarRow
      key={`${this.state.selectedAttribute}-${datum.name}`}
      data={datum}
      index={index}
      zIndex={this.attribute.displayValues.length - index}
      isLast={index >= Math.max(4, this.attribute.displayValues.length - 4)}
      yOffset={yOffset}
      labelKey="name"
      filters={this.state.filters} // TODO: replace w/ minibar count prop
      metrics={this.metrics}
      scales={this.scales}
      tags={[]}
      isPercent={(this.state.mode === 'percent')}
      isRemoved={null}
      highlightedDatum={this.state.highlightedDatum}
      hoverDatum={this._hoverDatum}
      clickDatum={this._clickDatum}
      isAttribute
      unit={this.attribute.unit}
      styles={{
        cell: styles.cell,
        circle: gstyle.circle,
        name: styles.name,
        reads: styles.reads,
      }}
      renderSVG={this.state.renderSVG}
      forceOpenModal={this.state.helpCounter === 8 && index === 0}
    />
  );

  attrRow = ({ index, style }) => this.attr(this.attribute.displayValues[index], index, style.top)

  updateAttributeValues(attribute, data) {
    if (attribute !== '') {
      this.attributes[attribute].displayValues = visSortBy(
        this.attributes[attribute].values.map(a => {
          const datum = {};
          datum.name = (attribute === 'Year') ? a.value.toString() : a.value.toLocaleString();
          datum.samples = [...new Set(a.samples)];
          datum.sampleObjects = datum.samples.map(s => {
            const [sample] = data.filter(d => d.sampleName === s);
            return sample;
          }).filter(s => s !== undefined);
          datum.reads = datum.sampleObjects.map(s => s.reads).reduce((ac, v) => ac + v, 0);
          datum.sequences = nest()
            .key(s => s.name)
            .entries(datum.sampleObjects
              .map(s => s.sequences)
              .reduce((ac, v) => ac.concat(v), []))
            .map(s => ({
              name: s.key,
              reads: s.values.map(v => v.reads).reduce((ac, v) => ac + v, 0),
              taxonomy: s.values[0].taxonomy,
            }));
          return datum;
        })
          .filter(v => {
            if (this.state.showEmptyAttrs) return true;
            return v.reads > 0;
          }),
        this.state.sortReverse,
        this.state.sortKey,
      );
    }
  }

  renderAttributesSelect() {
    const options = [<option key="none" value="">None</option>]
      .concat(Object.keys(this.attributes).map(a => <option key={a} value={a}>{a}</option>));
    const onSelectChange = (event) => {
      const selectedAttribute = event.target.value;
      this.updateAttributeValues(selectedAttribute, this.state.data);
      this.setState({ selectedAttribute }, () => {
        this.save(this.setResult);
      });
    };
    const active = (this.state.selectedAttribute !== '') ? styles.selected : '';
    return (
      <Spotlight
        isActive={this.state.helpCounter === 8}
        style={{ boxShadow: 'rgba(255, 255, 255, 0.4) 0 0 10px 3px',
          padding: '0.5em',
          margin: '-0.5em',
          borderRadius: '0.5em',
        }}

      >
        <div className={styles.inlineControl} style={{ opacity: this.state.helpCounter === 8 ? '1' : null}}>
          <label htmlFor="attributesSelect">
            {'Attributes '}
            <select
              id="attributesSelect"
              onChange={onSelectChange}
              className={`${active}`}
              style={{ marginRight: 0, width: '200px' }}
              value={this.state.selectedAttribute}
            >
              {options}
            </select>
          </label>
        </div>
      </Spotlight>
    );
  }

  renderShow() {
    const showOptions = [
      {
        id: 'phinchName',
        name: 'Phinch Name',
      },
      {
        id: 'sampleName',
        name: 'Sample Name',
      },
    ];
    const options = showOptions.map(o => <option key={o.id} value={o.id} style={styles.selectItems}>{o.name}</option>);
    const onSelectChange = (event) => {
      const labelKey = event.target.value;
      this.setState({ labelKey }, () => {
        this.save(this.setResult);
      });
    };
    return (
      <div className={styles.inlineControl}>
        <label htmlFor="showSelect">
          {'Show: '}
          <select
            id="showSelect"
            onChange={onSelectChange}
            className={styles.inlineControl}
            value={this.state.labelKey}
            disabled={this.state.selectedAttribute !== ''}
          >
            {options}
          </select>
        </label>
      </div>
    );
  }

  renderSort() {
    const sampleOptions = [
      {
        id: 'biomid',
        name: 'BIOM ID',
      },
      {
        id: 'phinchName',
        name: 'Phinch Name',
      },
      {
        id: 'reads',
        name: 'Sequence Reads',
      },
    ];
    const attrOptions = [
      {
        id: 'name',
        name: 'Name',
      },
      {
        id: 'reads',
        name: 'Sequence Reads',
      },
    ];
    const sortOptions = this.state.selectedAttribute !== '' ? attrOptions : sampleOptions;
    const options = sortOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>);
    const onSelectChange = (event) => {
      const sortKey = event.target.value;
      const isAttribute = this.state.selectedAttribute !== '';
      const indata = isAttribute
        ? this.attributes[this.state.selectedAttribute].displayValues
        : this.state.data;
      const data = visSortBy(indata, this.state.sortReverse, sortKey);
      if (isAttribute) {
        this.attributes[this.state.selectedAttribute].displayValues = data;
        this.setState({ sortKey }, () => this.save(this.setResult));
      } else {
        this.setState({ data, sortKey }, () => this.save(this.setResult));
      }
    };
    const radioOptions = [
      {
        name: 'Ascending',
        value: true,
      },
      {
        name: 'Descending',
        value: false,
      },
    ];
    const onRadioChange = (event) => {
      const sortReverse = event.target.name === 'Ascending';
      const isAttribute = this.state.selectedAttribute !== '';
      const indata = isAttribute
        ? this.attributes[this.state.selectedAttribute].displayValues
        : this.state.data;
      const data = visSortBy(indata, sortReverse, this.state.sortKey);
      if (isAttribute) {
        this.attributes[this.state.selectedAttribute].displayValues = data;
        this.setState({ sortReverse }, () => this.save(this.setResult));
      } else {
        this.setState({ data, sortReverse }, () => this.save(this.setResult));
      }
    };
    const buttons = radioOptions.map(o => {
      const checked = this.state.sortReverse === o.value ? 'checked' : '';
      return (
        <div key={o.name} className={classNames(styles.inlineControl, { [styles.controlChecked]: checked })}>
          <label htmlFor={o.name}>
            <input
              type="radio"
              id={o.name}
              key={o.name}
              name={o.name}
              checked={checked}
              onChange={onRadioChange}
            />
            {o.name}
          </label>
        </div>
      );
    });
    return (
      <div className={styles.inlineControl} style={{ marginRight: 0 }}>
        <label htmlFor="sortSelect">
          {'Sort by: '}
          <select
            id="sortSelect"
            onChange={onSelectChange}
            className={styles.inlineControl}
            value={this.state.sortKey}
          >
            {options}
          </select>
        </label>
        {buttons}
      </div>
    );
  }

  renderToggle() {
    const buttons = [
      {
        id: 'percent',
        name: 'Relative',
      },
      {
        id: 'value',
        name: 'Absolute',
      },
    ];
    const toggle = buttons.map(b => {
      const onRadioChange = (event) => {
        this.setState({ mode: event.target.id }, () => {
          this.save(this.setResult);
        });
      };
      const checked = this.state.mode === b.id ? 'checked' : '';
      return (
        <div key={b.id}  className={classNames(styles.inlineControl, { [styles.controlChecked]: checked })}>
          <label htmlFor={b.id}>
            <input
              type="radio"
              id={b.id}
              name={b.name}
              checked={checked}
              onChange={onRadioChange}
            />
            {b.name}
          </label>
        </div>
      );
    });
    return (
      <div className={styles.inlineControl}>
        {toggle}
      </div>
    );
  }

  renderLevelSelector(levels, dataLength) {
    const modalLevel = (this.state.width - 580) < ((800 / 12) * this.levels.length);
    const levelButtons = levels.map((l, i) => {
      const selected = (l.order <= this.state.level) ? styles.selected : '';
      return (
        <div
          key={l.name}
          style={{
            display: 'inline-block',
            marginBottom: '4px',
            position: 'relative',
            zIndex: dataLength + 1,
          }}
        >
          {(i === 0) ? '' : (<div className={`${selected} ${styles.dash}`}>—</div>)}
          <div
            role="button"
            tabIndex={0}
            className={`${selected} ${styles.selector}`}
            onClick={() => this.setLevel(l.order)}
            onKeyPress={e => (e.key === ' ' ? this.setLevel(l.order) : null)}
          >
            {l.name}
          </div>
        </div>
      );
    });
    const [currentLevel] = this.levels.filter(l => l.order === this.state.level);
    const levelSelector = modalLevel ? (
      <Modal
        buttonTitle={`Level: ${currentLevel.name}`}
        modalTitle={`Level: ${currentLevel.name}`}
        buttonPosition={{
          position: 'relative',
          height: '24px',
          borderRadius: '4px',
          backgroundColor: '#4d4d4d',
        }}
        modalPosition={{
          position: 'fixed',
          zIndex: dataLength + 1,
          top: 136,
          left: this.metrics.leftSidebar,
          width: this.metrics.chartWidth + (this.metrics.nonbarWidth - 4),
          height: '98px',
          color: 'white',
        }}
        data={levelButtons}
      />
    ) : (
      <div className={styles.inlineControl}>
        {levelButtons}
      </div>
    );
    return levelSelector;
  }

  updateSequences() {
    return Object.keys(this.readsBySequence)
      .map(k => ({ name: k, reads: this.readsBySequence[k] }))
      .sort((a, b) => b.reads - a.reads)
      .map((s, i) => {
        s.rank = (i + 1);
        return s;
      });
  }

  renderTopSequences() {
    return this.sequences.map((s, i) => (
      <Sequence
        seq={s}
        index={i}
        key={s.name}
        scales={this.scales}
        metrics={this.metrics}
        filters={this.state.filters}
        renderSVG={this.state.renderSVG}
        yOffset={this.metrics.sequenceRowHeight * i}
        removeFilter={this.removeFilter}
        clickDatum={this._clickDatum}
      />
    ));
  }

  renderTagFilter() {
    const tagFilter = this.state.showTags ? (
      <div key="tagFilter" className={styles.tagFilter}>
        {
          this.state.tags.map(t => {
            const tagClass = styles.tag;
            return (
              <div
                key={`tf-${t.id}`}
                style={{
                  padding: '2px 0',
                }}
                className={tagClass}
              >
                <label htmlFor={`c-${t.id}`} className={gstyle.checkbox}>
                  <input
                    id={`c-${t.id}`}
                    type="checkbox"
                    checked={t.selected}
                    onChange={(e) => {this.filterByTag(e, t), this.setActiveTags}}
                    style={{ top: 0, left: '-3px' }}
                  />
                  <span className={gstyle.checkmark} />
                </label>
                {
                  t.color ? (
                    <div
                      className={gstyle.circle}
                      style={{
                        backgroundColor: t.color,
                        border: 'none',
                        margin: "0 .25rem 5px",
                        opacity: t.selected ? 1 : 0.5,
                      }}
                    />
                  ) : ''
                }
                <input
                  className={`${gstyle.input} ${styles.tagName} ${t.selected ? styles.selected : ''}`}
                  type="text"
                  value={t.name}
                  id={t.id}
                  ref={i => { this._inputs[t.id] = i; }}
                  onChange={e => this.updateTagName(e, t)}
                  onKeyPress={e => (e.key === 'Enter' ? this._inputs[t.id].blur() : null)}
                  onMouseOver={this._hoverTag}
                  onFocus={this._hoverTag}
                  onMouseOut={this._unhoverTag}
                  onBlur={this._unhoverTag}
                  disabled={!t.color}
                />
                <div className={styles.editTag}>edit</div>
              </div>
            );
          })
        }
      </div>
    ) : '';
    const showTags = this.state.showTags ? styles.selected : '';
    return (
      <div
        className={styles.inlineControl}
      >
        <div
          role="button"
          tabIndex={0}
          className={styles.inlineControl}
          onClick={this._toggleTags}
          onKeyPress={e => (e.key === ' ' ? this._toggleTags() : null)}
          style={{ backgroundColor: '#2d2f31', borderRadius: '3px', }}
        >
          <div key="tags" className={`${styles.selector} ${styles.button} ${showTags}`}>Tags</div>
          {
            this.state.tags.map(t => (t.color ? (
              <div
                key={`c-${t.id}`}
                className={gstyle.circle}
                style={{
                  background: t.color,
                  opacity: t.selected ? 1 : 0.5,
                  verticalAlign: 'middle',
                }}
              />
            ) : ''))
          }
          <img style={{marginRight: '6px', width: "10px"}} src={dropDownArrow} />
        </div>
        {tagFilter}
      </div>
    );
  }

  /*This function deals with when the mouse hovers over the browse icon on top right of
   and changes img src accordingly to correct svg file */
   handleMouseOver (button) {
    switch(button) {
      case "help":
        if(this.state.helpButton === needHelp) {
          this.setState({helpButton: needHelpHover});
        }
        break;
    }
  }

  /*This function deals with the mouse leaving an icon (no longer hovering) and
  changed img src to correct svg file */
  handleMouseLeave (button) {
    switch(button) {
      case "help":
        if(this.state.helpButton === needHelpHover) {
          this.setState({helpButton: needHelp});
        }
        break;
    }
  }

  makeHelpButtons() {
    return (
      <div className={gstyle.helpIcons}>
        <div
        role="button"
        style={{ marginRight: '4em'}}
        className={gstyle.helpIcons}
        onClick={() => {this.setState({ helpCounter: 0 }); this.forceUpdate();} }
        >
          <img src={closeHelp} alt="close-walkthrough" />
        </div>

        <div
        role="button"
        tabIndex={0}
        className={gstyle.helpIcons}
        onClick={() => this.setState({ helpCounter: 1 })}
        >
          <img src={this.state.helpCounter == 2 ? help1Hover : help1} />
        </div>

        <div
        role="button"
        tabIndex={0}
        className={gstyle.helpIcons}
        onClick={() => this.setState({ helpCounter: 2 })}
        >
          <img src={this.state.helpCounter == 3 ? help2Hover : help2} />
        </div>

        <div
        role="button"
        tabIndex={0}
        className={gstyle.helpIcons}
        onClick={() => this.setState({ helpCounter: 3 })}
        >
          <img src={this.state.helpCounter == 4 ? help3Hover : help3} />
        </div>

        <div
        role="button"
        tabIndex={0}
        className={gstyle.helpIcons}
        onClick={() => this.setState({ helpCounter: 4 })}
        >
          <img src={this.state.helpCounter == 5 ? help4Hover : help4} />
        </div>

        <div
        role="button"
        tabIndex={0}
        className={gstyle.helpIcons}
        onClick={() => this.setState({ helpCounter: 5 })}

        >
          <img src={this.state.helpCounter == 6 ? help5Hover : help5} />
        </div>
        {this._visType === 'stackedbar' ? <React.Fragment>
          <div
            role="button"
            tabIndex={0}
            className={gstyle.helpIcons}
            onClick={() => this.setState({ helpCounter: 6 })}
          >
            <img src={this.state.helpCounter == 7 ? help6Hover : help6} />
          </div>
          <div
            role="button"
            tabIndex={0}
            className={gstyle.helpIcons}
            onClick={() => this.setState({ helpCounter: 7 })}
          >
            <img src={this.state.helpCounter == 8 ? help7Hover : help7} />
          </div>
          <div
            role="button"
            tabIndex={0}
            className={gstyle.helpIcons}
            onClick={() => this.setState({ helpCounter: 8 })}
          >
            <img src={this.state.helpCounter == 9 ? help8Hover : help8} />
          </div>

        </React.Fragment> : null}
      </div>
    );
  }


  render() {
    const redirect = this.state.redirect === null ? '' : <Redirect push to={this.state.redirect} />;

    const visType = this.props.match.params.visType || 'stackedbar';
    this._visType = visType;

    const helpButtons = this.state.counter > 0 ? this.makeHelpButtons() : '';
    // console.log('render', { showRightSidebar: this.state.showRightSidebar, overrideRightSidebar: this.state.overrideRightSidebar });
    const isAttribute = (
      this.state.selectedAttribute !== ''
        &&
      this.attributes[this.state.selectedAttribute].displayValues
    );
    // console.log(isAttribute, this.state.selectedAttribute, this.attributes)

    this.attribute = isAttribute ? this.attributes[this.state.selectedAttribute] : null;
    const dataLength = isAttribute ? this.attribute.displayValues.length : this.state.data.length;

    let maxReads = 1;
    if (dataLength) {
      maxReads = isAttribute
        ? Math.max(...this.attribute.displayValues.map(d => d.reads))
        : Math.max(...this.state.data.map(d => d.reads));
    }
    this.scales.x
      .domain([0, maxReads])
      .range([0, this.metrics.chartWidth])
      .clamp();

    const color = this.state.highlightedDatum ? (
      this.scales.c(this.state.highlightedDatum.datum.name)
    ) : '';
    const tooltip = this.state.showTooltip ? (
      <StackedBarTooltip
        {...this.state.highlightedDatum}
        totalDataReads={this.totalDataReads}
        color={color}
        spotlight={this.state.helpCounter === 7}
      />
    ) : null;

    const result = this.state.result ? (
      <div
        role="button"
        tabIndex={0}
        className={gstyle.button}
        style={{
          position: 'absolute',
          top: 'calc(100vh - 40px)',
          right: '16px',
          width: '68px',
          textAlign: 'center',
          zIndex: 10,
          fontWeight: 400,
          color: '#191919',
          border: 'none',
          borderRadius: '8px',
          padding: 0,
          background: (this.state.result === 'error') ? '#ff2514' : '#00da3e',
        }}
        onClick={this.clearResult}
        onKeyPress={e => (e.key === ' ' ? this.clearResult() : null)}
      >
        {this.state.result}
      </div>
    ) : '';

    const spacer = <div className={styles.spacer} />;

    const svgHeight = (this.metrics.lineHeight * 4) + (
      (this.metrics.barContainerHeight + (
        this.metrics.miniBarContainerHeight * Object.keys(this.state.filters).length
      )) * dataLength);

    const ticks = (
      <StackedBarTicks
        metrics={this.metrics}
        scale={this.scales.x}
        mode={this.state.mode}
        width={this.state.width}
        svgWidth={this.metrics.chartWidth + this.metrics.nonbarWidth}
        svgHeight={svgHeight - (this.metrics.lineHeight * 3)}
      />
    );

    // console.log(this.state.helpCounter === 1, visType === 'stackedbar', this.state.helpCounter === 1 && visType === 'stackedbar', this.state.helpCounter, visType)
    return (
      <div className={gstyle.container}>
        {redirect}
        {result}
        <div className={styles.sbgLogo}>
          <Link to="/">
            <img src={logo} alt="Phinch" />
          </Link>
          <button
            className={gstyle.help}
            // on click command is still undefined outside of home page, set to issues page for now until later
            onClick={() => this.setState({ helpCounter: 1 })}
            onMouseEnter={() => this.handleMouseOver("help")}
            onMouseLeave={() => this.handleMouseLeave("help")}
            >
              <img src={this.state.helpButton} alt="needHelp" />
          </button>
        </div>
        <div
          className={`${gstyle.header} ${gstyle.darkbgscrollbar}`}
          style={{
            zIndex: visType === 'stackedbar' ?
              (
                this.state.helpCounter === 0 ||
                this.state.helpCounter === 3 ||
                this.state.helpCounter === 5 ||
                this.state.helpCounter === 8 ? 2000 : 1000

              ) :
              visType === 'sankey' ?
              this.state.helpCounter === 2 ? 2000 : 1000
              : 2000
            }}>
          <Summary
            summary={this.state.summary}
            observations={this.state.observations}
            datalength={this.state.data.length}
            opacity={this.state.helpCounter === 0 ? 1 : 0.2}
          />
          <SpotlightWithToolTip
            isActive={visType === 'stackedbar' && this.state.helpCounter === 3}
            toolTipPlacement='bottomLeft'
            overlayStyle={{maxWidth: "850px", zIndex: '10000'}}
            toolTipTitle={<div>
              Further editing or filtering can be carried out using the buttons and dropdown menus on the top panel. Any change made here will impact how the underlying data is summarized and visualized.
              <br /><br />
              Current selections and options will be highlighted in orange (activated), and those not editable or selectable will be greyed out (inactivated).
            </div>}
          >
            <div className={styles.controls}>
              <div className={styles.controlRow} style={{
                display: 'flex',
                opacity: visType === 'stackedbar' && (
                  this.state.helpCounter === 3 ||
                  this.state.helpCounter === 5
                ) ? 1 : this.state.helpCounter === 0 ? 1 : 0.2
              }}>
                {
                  visType === 'stackedbar' ? <React.Fragment>
                  <SpotlightWithToolTip
                    isActive={visType === 'stackedbar' && this.state.helpCounter === 5}
                    toolTipPlacement='bottomLeft'
                    toolTipTitle={<div>
                      The search box on the top left will highlight the search result in the graph, and auto-complete based on the information contained within the uploaded file itself (e.g. so any search result that show up is a taxon/gene name (or other metadata text string) that is IN YOUR FILE).
                      <br /><br />
                      After clicking the search result (selecting an item in the list below the search field), the selected item will be highlighted in the main bar graph and a side bar will become activated (see next step).
                    </div>}
                    overlayStyle={{
                      zIndex: '10000',
                    }}
                  >
                    {this.renderSearch()}
                  </SpotlightWithToolTip>
                  <div
                    style={{ display: 'flex',
                    opacity: visType === 'stackedbar' && this.state.helpCounter === 5 ? 0.2 : null

                  }}
                  >
                    {this.renderShow()}
                    {this.renderSort()}
                    {spacer}
                    {this.renderToggle()}
                  </div>
                </React.Fragment> : visType === 'sankey' ? <React.Fragment>
                  {this.renderSearch()}
                  <div className={styles.inlineControl}>
                    <label htmlFor='sankeyColors'>
                      Link Colors:{' '}
                      <select
                        id='sankeyColors'
                        value={this.state.sankeyColors}
                        onChange={e => this.setState({ sankeyColors: e.target.value })}
                      >
                        {/* <option value="mix">mix</option> */}
                        <option value="left">left</option>
                        <option value="right">right</option>
                      </select>
                    </label>

                  </div>

                </React.Fragment> : null
              }
              </div>
              <SpotlightWithToolTip
                isActive={this.state.helpCounter === 2 && visType === 'sankey'}
                style={{ boxShadow: 'rgba(255, 255, 255, 0.4) 0 0 10px 3px',
                  // borderBottomLeftRadius: '0',
                  // borderBottomRightRadius: '0',
                }}
              >
                <div className={classNames(styles.controlRow, { [styles.controlRowFadeChildren]: this.state.helpCounter === 8})}
                  style={{
                    paddingBottom: '0.5rem',
                    opacity: visType === 'stackedbar' && this.state.helpCounter === 5 ? 0.2 : 1,
                  }}>
                  {this.renderLevelSelector(this.levels, dataLength)}
                  {visType === 'sankey' ?
                    null :
                    <React.Fragment>
                      {this.levels.length ? <div className={styles.spacer} style={{ marginLeft: '8px'}} /> : null}
                      {this.renderAttributesSelect()}
                      <div className={styles.spacer} style={{ marginRight: '12px'}} />
                      {this.renderTagFilter()}
                    </React.Fragment>
                  }
                </div>
              </SpotlightWithToolTip>
            </div>
          </SpotlightWithToolTip>
        </div>

        <SideMenu
          showLeftSidebar={this.state.showLeftSidebar}
          leftSidebar={this.metrics.leftSidebar}
          leftMin={this.metrics.left.min}
          chartHeight={this.metrics.chartHeight + (this.metrics.lineHeight * 2)}
          items={this.menuItems}
          toggleMenu={this.toggleMenu}
          spotlight={visType === 'sankey' ? this.state.helpCounter === 6 : this.state.helpCounter === 9}
          helpText={
            this.state.helpCounter === 6 ?
            <div>
              The sidebar on the left can be used to save the displayed sankey visual to file (Save button), go back to the filter window (Back button), or export a publication-read SVG image of the displayed visualization (Export SVG button).
            </div> :
            <div>
              Clicking the Phinch logo in the upper left corner of the app will direct you back to the App homepage. The App automatically saves your work in progress, and you can return to your visual manipulations by re-selecting your project file on the homepage.
              <br /><br />
              Clicking the menu button underneath the Phinch logo will expand a side panel, revealing buttons that allow you to save your work, go back to the filter page window, or export a SVG graphic showing your customized visualization currently displayed in the main window.
            </div>
          }
        />
        <SpotlightWithToolTip
          isActive={(this.state.helpCounter === 2 || this.state.helpCounter === 4 || this.state.helpCounter === 8 )&& visType === 'stackedbar'}
          toolTipPlacement={ this.state.helpCounter === 2 ? "topLeft" : "bottomLeft"}
          overlayStyle={{maxWidth: "950px"}}

          toolTipTitle={
            this.state.helpCounter === 2 ? (
              <div>
                The graphs are visualized based on users’ setting on data filtering page, which means the actions taken previously will affect the visualisation shown here.
                The top sequences box below shows the most abundant observations in your TOTAL dataset, with numerical values calculated after filter page settings have been applied.
              </div>
            ) : this.state.helpCounter === 4 ? (
              <div>
                By hovering on the sample, you will see “EDIT TAG” and “ARCHIVE” for each individual sample. The tags can only be removed on this level (no attributes selected), which means it will not be editable under single attribute or on taxonomic levels.
                <br /><br />
                The visuals displayed can be updated by tag filter menu on the top right. When there is any tag selected, the “tags” will be highlighted in orange and selected tags will be shown in full opacity.
                <br /><br />
                The end user can edit and customize all text labels for each tag by double-clicking its texts in the dropdown menu. Tags are used for labelling samples, and multiple tags can be attached to any given sample.
              </div>
            ) : this.state.helpCounter === 8 ? (
              <div>
                If a specific category is chosen from the “Attributes” drop down list on the top panel (take “{this.state.selectedAttribute}” here as an example), then the main visual will be updated to reflect the selected attribute.
                The bar chart will show the overall proportions for all observations in all samples associated with the selected “Attribute” category.
                <br /><br />
                If you hover the mouse over an individual selected attribute on the left hand side of the main visualization window, there will be a “See samples” button showing a list of included sample sets.
                In this example, hovering over the “{this.attribute && this.attribute.displayValues && this.attribute.displayValues[0] ? this.attribute.displayValues[0].name : ''}” group is showing a list of all the samples whose data is being combined and visualized in that specific bar graph row.
              </div>
            ) : null
          }
        >
          <div
            className={classNames(gstyle.panel,  gstyle.noscrollbar)}
            style={{
              width: this.metrics.chartWidth + this.metrics.nonbarWidth,
            }}
            >
            { visType === 'stackedbar' ? (
              <div
                className={styles.axis}
                style={{
                  width: this.metrics.chartWidth + (this.metrics.nonbarWidth - this.metrics.padding),
                  height: this.metrics.lineHeight * 2,
                  top: visType === 'stackedbar' && (this.state.helpCounter === 2 || this.state.helpCounter === 4 || this.state.helpCounter === 8) ? '0' : null,
                }}
              >
                <svg
                  fontFamily="Open Sans"
                  fontWeight="200"
                  fontSize="12px"
                  style={{
                    position: 'absolute',
                    left: 0,
                    pointerEvents: 'none',
                    width: (this.metrics.chartWidth + this.metrics.nonbarWidth),
                    height: this.metrics.chartHeight,
                  }}
                >
                  {ticks}
                </svg>
                {
                  isAttribute ? (
                    <div className={styles.attrInfo}>
                      <div className={styles.attrLabel}>
                        {this.attribute.key} {this.attribute.unit ? `(${this.attribute.unit})` : ''}
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className={styles.attrToggle}
                        onClick={this.toggleEmptyAttrs}
                        onKeyPress={e => (e.key === ' ' ? this.toggleEmptyAttrs() : null)}
                      >
                        {`${this.state.showEmptyAttrs ? 'Hide' : 'Show'} Empty`}
                      </div>
                    </div>
                  ) : ''
                }
              </div>
            ) : null }
            <div
              className={classNames(gstyle.panel,  gstyle.noscrollbar, {
                [gstyle.panelNoYScroll]: visType === 'sankey'
              })}
              style={{
                backgroundColor: '#ffffff',
                width: (this.metrics.chartWidth + this.metrics.nonbarWidth),
                height: this.metrics.chartHeight -
                  (this.state.helpCounter === 2 && visType === 'stackedbar' ? 100 :
                  this.state.helpCounter === 4 && visType === 'stackedbar' ? this.metrics.chartHeight / 2 :
                  this.state.helpCounter === 8 && visType === 'stackedbar' ? this.metrics.chartHeight / 2
                  : 0),
                pointerEvents: (visType === 'stackedbar' &&
                  (this.state.helpCounter === 4 && this.state.helpCounter === 8)
                ) ? 'none' : null,

              }}
            >
              {
                this.state.renderSVG && visType === 'stackedbar' ? (
                  <StackedBarsSVG
                    setRef={r => { this._svg = r; }}
                    id={this.state.summary.path.slice(-1)}
                    svgWidth={this.metrics.chartWidth + this.metrics.nonbarWidth}
                    svgHeight={svgHeight}
                    seqHeight={this.metrics.sequenceRowHeight * this.topSequences.length}
                    data={isAttribute ? this.attribute.displayValues : this.state.data}
                    row={isAttribute ? this.attrRow : this.stackRow}
                    itemSize={this.metrics.barContainerHeight + (
                      this.metrics.miniBarContainerHeight * Object.keys(this.state.filters).length
                    )}
                    padding={this.metrics.padding}
                    ticks={ticks}
                    topSequences={this.renderTopSequences()}
                  />
                ) : (
                  visType === 'stackedbar' ?
                    <List
                      className={`${styles.svglist}`}
                      innerElementType="svg"
                      width={this.metrics.chartWidth + this.metrics.nonbarWidth}
                      height={this.metrics.chartHeight - (this.metrics.padding * 4)}
                      itemSize={this.metrics.barContainerHeight + (
                        this.metrics.miniBarContainerHeight * Object.keys(this.state.filters).length
                      )}
                      itemCount={dataLength}
                      itemKey={index => (isAttribute
                        ? this.attribute.displayValues[index].name : this.state.data[index].sampleName
                      )}
                    >
                      {isAttribute ? this.attrRow : this.stackRow}
                    </List>
                  : visType === 'sankey' ?
                    <Sankey
                      setRef={r => { this._svg = r; }}

                      data={this.state.data} preData={this.state.preData}
                      width={this.metrics.chartWidth + this.metrics.nonbarWidth}
                      height={this.metrics.chartHeight}
                      colors={this.state.sankeyColors}
                      renderSVG={this.state.renderSVG}
                      helpCounter={this.state.helpCounter}
                      clickDatum={this._clickDatum}
                      colorScale={this.scales.c || (() => {})}
                      highlightedDatum={this.state.highlightedDatum}
                    />
                  : null
                )

              }
            </div>
          </div>
        </SpotlightWithToolTip>
        {this.renderFilters()}
        {tooltip}
        <Modal
          buttonTitle="Top Sequences"
          modalTitle="Top Sequences"
          buttonPosition={{
            position: 'absolute',
            bottom: 0,
            left: (
              this.metrics.leftSidebar + this.metrics.barInfoWidth + (this.metrics.padding / 2) + 2
            ),
          }}
          modalPosition={{
            position: 'absolute',
            zIndex: dataLength + 1,
            bottom: this.metrics.padding * 2,
            left: this.metrics.leftSidebar,
            width: this.metrics.chartWidth + (this.metrics.nonbarWidth - 4),
          }}
          data={this.topSequences}
          svgContainer
          svgHeight={this.metrics.sequenceRowHeight * this.topSequences.length}
        />
        <Modal
          buttonTitle="Archived Samples"
          modalTitle="Archived Samples"
          buttonPosition={{
            position: 'absolute',
            bottom: 0,
            left: (
              this.metrics.leftSidebar + this.metrics.barInfoWidth + this.metrics.padding + 2 + 130
            ),
          }}
          modalPosition={{
            position: 'absolute',
            zIndex: dataLength + 1,
            bottom: this.metrics.padding * 2,
            left: this.metrics.leftSidebar,
            width: this.metrics.chartWidth + (this.metrics.nonbarWidth - 4),
          }}
          useList
          data={this.state.deleted}
          row={this.stack}
          dataKey="sampleName"
          itemHeight={this.metrics.barContainerHeight +
            (this.metrics.miniBarContainerHeight * Object.keys(this.state.filters).length)
          }
          svgContainer
          badge
        />

        <SpotlightWithToolTip
          isActive = {this.state.helpCounter > 0}
          inheritParentBackgroundColor={false}
          toolTipTitle={"* mouse click anywhere to advance"}
          overlayStyle={{zIndex: '1001'}}
          innerStyle={{color: 'white', fontWeight: '400', fontSize: '14px'}}
          style={{boxShadow: 'none'}}
        >
          <div className={gstyle.helpButtons}>
            {this.state.helpCounter > 0 ? this.makeHelpButtons() : null}
          </div>
        </SpotlightWithToolTip>
      </div>

    );
  }
}
