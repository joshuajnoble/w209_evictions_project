function by_weeks_viz_per_city(cle_element, col_element, cin_element, legend) {

  //Width and height
  var w = 350;
  var h = 360;

  //Define map projection
  var cin_projection = d3.geoMercator()
    .center([-84.512016, 39.203119])
    .scale([100 * w])
    .translate([w / 2, h / 2]);

  //Define map projection
  var cle_projection = d3.geoMercator()
    .center([-81.681290, 41.505493])
    .scale([160 * w])
    .translate([w / 2, h / 2]);

  //Define map projection
  var col_projection = d3.geoMercator()
    .center([-82.983330, 39.983334])
    .scale([100 * w])
    .translate([w / 2, h / 2]);

  // Define nicer colors
  var colors = d3.scaleSequential(d3.interpolatePlasma).domain([0, 6])

  //Create SVG
  var cle_svg = d3.select(cle_element)
    .append("svg")
    .attr("width", w)
    .attr("height", h);

  //Create SVG
  var col_svg = d3.select(col_element)
    .append("svg")
    .attr("width", w)
    .attr("height", h);

  //Create SVG
  var cin_svg = d3.select(cin_element)
    .append("svg")
    .attr("width", w)
    .attr("height", h);

  var all_svgs = [cle_svg, col_svg, cin_svg];
  var cities = null;
  var weeks = [];

  var colors_for_legend = [{
    label: "Below Average",
    color: "#0D0887"
  }, {
    label: "100% of Average",
    color: "#7E03A8"
  }, {
    label: "200% of Average",
    color: "#CC4778"
  }, {
    label: "300% of Average",
    color: "#F89540"
  }, {
    label: "> 300% of Average",
    color: "#FDC527"
  }];


  var legend = d3.select(legend).append("svg").attr("width", 120).attr("height", 240);

  // Add one dot in the legend for each name.
  legend.selectAll("mydots")
    .data(colors_for_legend)
    .enter()
    .append("circle")
    .attr("cx", 10)
    .attr("cy", function(d, i) {
      return 100 + i * 25
    }) // 100 is where the first dot appears. 25 is the distance between dots
    .attr("r", 7)
    .style("fill", function(d) {
      return d.color
    })

  // Add one dot in the legend for each name.
  legend.selectAll("mylabels")
    .data(colors_for_legend)
    .enter()
    .append("text")
    .attr("x", 20)
    .attr("font-size", 12)
    .attr("y", function(d, i) {
      return 100 + i * 25
    }) // 100 is where the first dot appears. 25 is the distance between dots
    .style("fill", function(d) {
      return d.color
    })
    .text(function(d) {
      return d.label
    })
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle");

  function week_formatter(date) {
    var d = new Date(date);
    var month = d.toLocaleString('default', {
      month: 'short'
    });
    return month.toString() + " " + d.getFullYear().toString().substring(2, 4);
  }

  var current_week = 1;

  d3.csv("data/cities_weekly_2020_2021.csv").then(res => {
    cities = res;
    weeks = [...new Set(cities.map(data => data.week_date))]

    ////////////////////////////////////////////////////////////////////
    // now draw everything
    ////////////////////////////////////////////////////////////////////

    load_geojson("geojson/columbus_ct.json", col_element, col_json, col_svg, col_projection);
    load_geojson("geojson/cincinatti_ct.json", cin_element, cin_json, cin_svg, cin_projection);
    load_geojson("geojson/cleveland_ct.json", cle_element, cle_json, cle_svg, cle_projection);

    ////////////////////////////////////////////////////////////////////
    // build the slidr
    ////////////////////////////////////////////////////////////////////

    $(function() {
      $("#slider").slider({
          height: 50,
          width: 800,
          min: 1,
          max: weeks.length,
          slide: function(event, ui) {

            for (s in all_svgs) {
              console.log(s);
              all_svgs[s].selectAll("path")
                .attr("fill",
                  function(d, i) {
                    var geoid = d.properties.GEOID;
                    var city = cities.find(e => (e.GEOID == geoid && e.week == ui.value));
                    if (city != null) {
                      return colors(city.filings_2020 / Math.max(1.0, city.filings_avg))
                    } else {
                      return "none";
                    }
                  }
                );
            }
            d3.select('#value').text("Week of " + weeks[ui.value]);
            current_week = ui.value;
          }
        })
        .each(function() {
          // Get the options for this slider (specified above)
          var opt = $(this).data().uiSlider.options;

          // Get the number of possible values
          var vals = opt.max - opt.min;

          // Position the labels
          for (var i = 0; i <= vals; i += 5) {
            // Create a new element and position it with percentages
            var el = $('<li>' + week_formatter(weeks[(i + opt.min)]) + '</li>').css('left', (i / vals * 100) + '%');
            // Add the element inside #slider
            $("#slider_labels").append(el);
          }

        });
    });
    d3.select('#value').text("Week of " + weeks[1]);
  });

  var cin_json = {};
  var cle_json = {};
  var col_json = {};

  function load_geojson(file, element, store_obj, svg, projection) {

    //Define path generator
    var path = d3.geoPath().projection(projection);

    //Load in GeoJSON data
    d3.json(file).then(res => {

      store_obj = res;

      store_obj['features'].forEach(function(feature) {
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
        .data(store_obj.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("stroke", function(d, i) {
          var geoid = d.properties.GEOID;

          // is it the outline of the state?
          // if (geoid == "0400000US39") {
          //   return "#999999";
          // }

          var city = cities.find(e => (e.GEOID == geoid && e.week == current_week));
          if (city != null) {
            return "dimgray"
          }
          return "none";
        })
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
          var city = cities.find(e => (e.GEOID == geoid && e.week == current_week));
          if (city != null) {
            return colors(city.filings_2020)
          }
          return "none";
        })
        // When the mouse moves over a feature, show the tooltip.
        .on('mousemove', showTooltip)
        // When the mouse moves out of a feature, hide the tooltip.
        .on('mouseout', hideTooltip);
    });

    function zoomed() {
      svg.selectAll('path').attr('transform', d3.event.transform);
    }

    const zoom = d3.zoom().scaleExtent([1, 20]).on('zoom', zoomed);
    svg.call(zoom);

    var tooltip = d3.select(element)
      .append("div")
      .attr("class", "d3tooltip hidden");

    function showTooltip(f) {

      // const scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : 
      //   (document.documentElement || document.body.parentNode || document.body).scrollTop

      var scrollTop = $(window).scrollTop() / 12;
      //console.log(scrollTop);

      // Get the current mouse position (as integer)
      var mouse = d3.mouse(d3.select(element).node()).map(
        function(d) {
          return parseInt(d);
        }
      );

      // Calculate the absolute left and top offsets of the tooltip. If the
      // mouse is close to the right border of the map, show the tooltip on
      // the left.
      var left = Math.min(w - 4 * f.properties.NAMELSAD.length, mouse[0] + 5);

      if(svg == col_svg){
        left += 100;
      } else if(svg == cin_svg){
        left += 500;
      } 

      var top = scrollTop + mouse[1] + 25;

      var city = cities.find(e => (e.GEOID == f.properties.GEOID && e.week == current_week));
      var tooltipHTML = "";
      if (city != null) {
        tooltiphtml = "Average weekly evictions: " +
          parseFloat(city.filings_avg).toFixed(2) +
          "<br/> Evictions for week " +
          weeks[current_week] +
          " : " +
          city.filings_2020;
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
}