
function social_explorer_evictions(element, legend, selection, city) {
  //Width and height
  var w = 800;
  var h = 700;

  //Define map projection
  var cin_projection = d3.geoMercator()
    .center([-84.502016, 39.203119])
    .scale([140 * w])
    .translate([w / 2, h / 2]);

  //Define map projection
  var cle_projection = d3.geoMercator()
    .center([-81.681290, 41.505493])
    .scale([100 * w])
    .translate([w / 2, h / 2]);

  //Define map projection
  var col_projection = d3.geoMercator()
    .center([-82.983330, 39.983334])
    .scale([100 * w])
    .translate([w / 2, h / 2]);

  //Define map projection
  var projection = d3.geoMercator()
    .center([-81.681290, 41.505493])
    .scale([100 * w])
    .translate([w / 2, h / 2]);

  var d_domain = [];
  if (selection == "median") {
    d_domain = [0, 100000]
  } else if (selection == "renters") {
    d_domain = [0, 1.0]
  } else {
    d_domain = [0, 1.0]
  }

  // Define nicer colors
  //var colors = d3.scaleSequential(d3.interpolatePlasma).domain(d_domain);
    var colors = d3.scaleSequential(d3.interpolateOrRd).domain(d_domain)


  cities = {
      'cle':{'projection':cle_projection, 'geojson':"geojson/cleveland_ct.json", 'data':"data/cleveland_weekly_2020_2021.csv"},
      'col':{'projection':col_projection, 'geojson':"geojson/columbus_ct.json", 'data':"data/columbus_weekly_2020_2021.csv"},
      'cin':{'projection':cin_projection, 'geojson':"geojson/cincinatti_ct.json", 'data':"data/cincinnati_weekly_2020_2021.csv"}
    };

  var path = d3.geoPath().projection(cities[city].projection);
  
  d3.select(element).selectAll("svg").remove();
  d3.select(legend).selectAll("svg").remove();
  d3.select(element).selectAll(".d3tooltip").remove();

  //Create SVG
  var svg = d3.select(element)
    .append("svg")
    .attr("width", w)
    .attr("height", h);

  var social_explorer = null;
  var evictions_by_geoid = null;
  var all_data_by_geoid = null;

  // load our social explorer data
  d3.csv("data/social_explorer.csv").then(res => {
    social_explorer = res;
    for (record in social_explorer) {
      social_explorer[record]['fifty_percent_on_rent'] = Number(social_explorer[record].SE_A18002_005) / Number(social_explorer[record].SE_A18002_001);
      social_explorer[record]['renters'] = Number(social_explorer[record].SE_A10062B_001) / Number(social_explorer[record].SE_A00001_001);
      var p = Number(social_explorer[record].SE_A13004_002) + Number(social_explorer[record].SE_A13004_003) + Number(social_explorer[record].SE_A13004_004);
      social_explorer[record]['poverty'] = p / Number(social_explorer[record].SE_A13004_001);
    }


    // load our cleveland data
    d3.csv(cities[city].data).then(res => {
      //code dealing with data here
      all_data_by_geoid = res;
      evictions_by_geoid = d3.rollups(
        res,
        xs => d3.sum(xs, x => x.filings_avg),
        d => d.GEOID
      ).map(([k, v]) => ({
        geoid: k,
        average_filings: v
      }))
    });

      //Load in GeoJSON data
  d3.json(cities[city].geojson).then(res => {

    ohio_json = res;
    // winding might be bad, fix it
    ohio_json['features'].forEach(function(feature) {
      if (feature.geometry.type == "MultiPolygon") {
        feature.geometry.coordinates.forEach(function(polygon) {

          polygon.forEach(function(ring) {
            ring.reverse();
          })
        })
      } else if (feature.geometry.type == "Polygon") {
        feature.geometry.coordinates.forEach(function(ring) {
          ring.reverse();
        })
      }
    });
    //Bind data and create one path per GeoJSON feature
    svg.selectAll("path")
      .data(ohio_json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "dimgray")
      .attr("stroke-width", function(d, i) {
        var geoid = d.properties.GEOID;

        // is it the outline of the state?
        if (geoid == "0400000US39") {
          return "1.0";
        } else {
          return "0.1";
        }
      })
      .attr("fill", function(d, i) {
        var geoid = d.properties.GEOID;

        // is it the outline of the state?
        if (geoid == "0400000US39") {
          return "#999999";
        }

        var block = social_explorer.find(e => (e.GEO_FIPS == geoid));
        if (block != null) {

          if (selection == "renters") {
            return colors(block.renters)
          } else if (selection == "50pct") {
            return colors(block.fifty_percent_on_rent)
          } else if (selection == "median") {
            return colors(block.SE_A14006_001)
          } else {
            return colors(block.poverty)
          }

        } else {
          console.log(" no block found ")
        }
        return "rgb(240, 240, 255)";
      })
      // When the mouse moves over a feature, show the tooltip.
      .on('mousemove', showTooltip)
      // When the mouse moves out of a feature, hide the tooltip.
      .on('mouseout', hideTooltip)
      // click to show details
      .on('mousedown', showSidebar);

    ////////////////////////////////////////////////////////////////////////
    // legend
    ////////////////////////////////////////////////////////////////////////
    if (selection == "median") {
      var colors_for_legend = [{
        label: "$0",
        color: colors(0)
      }, {
        label: "$25000",
        color: colors(25000)
      }, {
        label: "$50000",
        color: colors(50000)
      }, {
        label: "$75000",
        color: colors(75000)
      }, {
        label: "$100000",
        color: colors(100000)
      }];

    } else {
      var colors_for_legend = [{
        label: "0%",
        color: colors(0)
      }, {
        label: "25%",
        color: colors(0.25)
      }, {
        label: "50%",
        color: colors(0.5)
      }, {
        label: "75%",
        color: colors(0.75)
      }, {
        label: "100%",
        color: colors(1.0)
      }];

    }

    var legend2 = d3.select(legend).append("svg").attr("width", 200).attr("height", 150);

    // Add one dot in the legend for each name.
    legend2.selectAll("mydots")
      .data(colors_for_legend)
      .enter()
      .append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("y", function(d, i) {
        return 10 + i * 25
      }) // 100 is where the first dot appears. 25 is the distance between dots
      .attr("x", 10)
      .style("fill", function(d) {
        return d.color
      })

    // Add one dot in the legend for each name.
    legend2.selectAll("mylabels")
      .data(colors_for_legend)
      .enter()
      .append("text")
      .attr("x", 30)
      .attr("font-size", 12)
      .attr("y", function(d, i) {
        return 16 + i * 25
      }) // 100 is where the first dot appears. 25 is the distance between dots
      .style("fill", function(d) {
        return "#000";
      })
      .text(function(d) {
        return d.label
      })
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle");
  });

  });

  var ohio_json = {};
  var current_week = 1;

  function zoomed() {
    svg.selectAll('path').attr('transform', d3.event.transform);
  }

  const zoom = d3.zoom().scaleExtent([1, 20]).on('zoom', zoomed);
  svg.call(zoom);

  ///////////////////////////////////////////////////////////////////////
  // Sidebar
  ///////////////////////////////////////////////////////////////////////

  function showSidebar(f) {
    if (!evictions_by_geoid || !social_explorer) {
      return;
    }

    // Get the current mouse position (as integer)
    var mouse = d3.mouse(d3.select(element).node()).map(
      function(d) {
        return parseInt(d);
      }
    );

    var cb = social_explorer.find(e => (e.GEO_FIPS == f.properties.GEOID));
    var cb_data = [];
    for (row in all_data_by_geoid) {
      //console.log(row);
      if (all_data_by_geoid[row].GEOID == cb.GEO_FIPS) {
        cb_data.push({
          filings: all_data_by_geoid[row].filings_2020,
          date: d3.timeParse("%Y-%m-%d")(all_data_by_geoid[row].week_date)
        });
      }
    }

    var margin = {
        top: 10,
        right: 10,
        bottom: 50,
        left: 40
      },
      width = 300 - margin.left - margin.right,
      height = 280 - margin.top - margin.bottom;

    d3.select("#map_2_sidebar").selectAll('*').remove();

    var family_pct = Math.round(parseFloat(Number(cb.SE_A10008_002) / Number(cb.SE_A10008_001)).toFixed(2) * 100)

    function get_pct(x, y) {
      var m = Math.round(parseFloat(Number(x) / Number(y)).toFixed(2) * 100);
      if (isNaN(m)) {
        return "N/A";
      } else {
        return m + "%";
      }
    }

    var header = d3.select("#map_2_sidebar").append("p").html("<b>Census Tract:</b> " + f.properties.GEOID + "<br/>" +
      "<b> Poverty rate among white residents</b>  " + get_pct(cb.SE_A13001A_002, cb.SE_A13001A_001) + "<br/>" +
      "<b> Poverty rate among black residents</b>  " + get_pct(cb.SE_A13001B_002, cb.SE_A13001B_001) + "<br/>" +
      "<b> Poverty rate among American Indian/Alaska Native residents</b>  " + get_pct(cb.SE_A13001C_002, cb.SE_A13001C_001) + "<br/>" +
      "<b> Poverty rate among Asian residents</b>  " + get_pct(cb.SE_A13001D_002, cb.SE_A13001D_001) + "<br/>" +
      "<b> Poverty rate among Hispanic/Latino residents</b>  " + get_pct(cb.SE_A13001F_002, cb.SE_A13001F_001) + "<br/>" +
      "<b> Residents Paying More Than 30% of Income on Rent</b>  " + get_pct(Number(cb.SE_B18002_002) + Number(cb.SE_B18002_003), cb.SE_B18002_001) + "<br/>" +
      "<b> Residents Paying More Than 50% of Income on Rent</b>  " + get_pct(cb.SE_B18002_003, cb.SE_B18002_001) + "<br/>" +
      "<b> Median Income $</b> " + Number(cb.SE_A14006_001) + "<br/>" +
      "<b> Families</b>  are " + family_pct + "% of Households").style("font-size", "12px");

    // append the svg object to the body of the page
    var sidebar_svg = d3.select("#map_2_sidebar")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime()
      .domain(d3.extent(cb_data, function(d) {
        return d.date;
      }))
      .range([0, width]);

    var x_axis = sidebar_svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(
        d3.axisBottom(x).tickFormat(function(date) {
          if (d3.timeYear(date) < date) {
            return d3.timeFormat('%b')(date);
          } else {
            return d3.timeFormat('%Y')(date);
          }
        })
      );

    x_axis.selectAll("text")
      .style("text-anchor", "end")
      .style("color", "#000")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-65)");

    // Add Y axis
    var y = d3.scaleLinear()
      .domain([0, 15])
      .range([height, 0]);
    var y_axis = sidebar_svg.append("g").call(d3.axisLeft(y));

    sidebar_svg.append("text") // text label for the x axis
      .attr("x", -120)
      .attr("y", -24)
      .style("text-anchor", "middle")
      .style("font-size", 12)
      .attr("transform", "rotate(-90)")
      .text("Evictions per week");

    y_axis.selectAll("text").style("color", "#000");

    x_axis.selectAll("line").style("stroke", "#000");
    x_axis.selectAll("path").style("stroke", "#000");
    y_axis.selectAll("line").style("stroke", "#000");
    y_axis.selectAll("path").style("stroke", "#000");

    // Add the line
    sidebar_svg.append("path")
      .datum(cb_data)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1.5)
      .attr("d", d3.line()
        .x(function(d) {
          return x(d.date)
        })
        .y(function(d) {
          return y(d.filings)
        })
      )

  }

  ///////////////////////////////////////////////////////////////////////
  // Tooltip
  ///////////////////////////////////////////////////////////////////////

  var tooltip = d3.select(element)
    .append("div")
    .attr("class", "d3tooltip hidden");

  function showTooltip(f) {

    if (!evictions_by_geoid || !social_explorer) {
      return;
    }

    var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop

    // Get the current mouse position (as integer)
    var mouse = d3.mouse(d3.select('#map_2').node()).map(
      function(d) {
        return parseInt(d);
      }
    );

    // Calculate the absolute left and top offsets of the tooltip. If the
    // mouse is close to the right border of the map, show the tooltip on
    // the left.
    var left = Math.min(w, mouse[0] + 5);
    var top = mouse[1] + (scrollTop / 7);

    var cb = social_explorer.find(e => (e.GEO_FIPS == f.properties.GEOID));

    if (!cb) {
      return;
    }

    var evictions = evictions_by_geoid.find(e => (e.geoid == cb.GEO_FIPS));

    var tooltip_start = "<b>Census Tract</b>: " + f.properties.GEOID + "<br/>";

    if (selection == "renters") {
      tooltip_start += "Renters are " + Math.round(parseFloat(cb.renters).toFixed(2) * 100) + "% of residents";
    } else if (selection == "50pct") {
      tooltip_start += Math.round(parseFloat(cb.fifty_percent_on_rent).toFixed(2) * 100) + "% of residents pay more than half their income in rent"
    } else if (selection == "median") {
      tooltip_start += "The median income here is $" + cb.SE_A14006_001 + "/year";
    } else {
      tooltip_start += Math.round(parseFloat(cb.poverty).toFixed(2) * 100) + "% of residents earn less than the federal poverty limit."
    }

    //console.log(city);
    var tooltipHTML = "";
    if (evictions != null) {
      tooltiphtml = tooltip_start + "<br/> Average Eviction Filings Per Year: " + parseFloat(evictions.average_filings).toFixed(2);
    } else if (cb != null && cb.area_deprivation_index_percent != "") {
      tooltiphtml = tooltip_start;
    } else {
      tooltiphtml = "No data";
    }

    // Show the tooltip (unhide it) and set the name of the data entry.
    // Set the position as calculated before.
    tooltip.classed('hidden', false)
      .attr("style", "left:" + left + "px; top:" + top + "px;")
      .html(tooltiphtml);
  }

  function hideTooltip() {
    tooltip.classed('hidden', true);
  }

}