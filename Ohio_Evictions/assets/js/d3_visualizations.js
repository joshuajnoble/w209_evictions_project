function adi_evictions(element)
{
  //Width and height
    var w = 800;
    var h = 700;

    //Define map projection
    var projection = d3.geoMercator()
                            .center([ -81.681290, 41.505493 ])
                            .scale([ 45 * w ])
                            .translate([ w/2, h/2 ]);
                          
    // Define nicer colors
    var colors = d3.scaleSequential(d3.interpolatePlasma).domain([0, 110])

    //Define path generator
    var path = d3.geoPath().projection(projection);

    //Create SVG
    var svg = d3.select(element)
                .append("svg")
                .attr("width", w)
                .attr("height", h);

    var adi = null;
    var evictions_by_geoid = null;
    var all_data_by_geoid = null;

    // load our ADI
    d3.csv("data/broadstreet_adi_ohio.csv").then(res => {
      adi = res;
      for(record in adi) {
        if(adi[record]['geoid2'] != null ) {
          var newstr = adi[record]['geoid2'].substring(0, adi[record].geoid2.length - 1);
          adi[record]['tract'] = newstr;
        } else {
          console.log('is null');
        }
      }
    });

    // load our ADI
    d3.csv("data/cleveland_weekly_2020_2021.csv").then(res => {
      //code dealing with data here
      all_data_by_geoid = res;
     evictions_by_geoid = d3.rollups(
        res,
        xs => d3.sum(xs, x => x.filings_avg),
        d => d.GEOID
      ).map(([k, v]) => ({ geoid: k, average_filings: v }))

     //console.log(evictions_by_geoid);
    });

    var ohio_json = {};
    var current_week = 1;

    //Load in GeoJSON data
    d3.json("geojson/cleveland_bg.json").then(res => {

      ohio_json = res;
      //Bind data and create one path per GeoJSON feature
      svg.selectAll("path")
        .data(ohio_json.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("stroke","dimgray")
        .attr("stroke-width","0.1")
        .attr("fill", function(d,i) {
          var geoid = d.properties.GEOID;
          var block = adi.find(e => (e.geoid2 == geoid));
          if(block != null) {
            //console.log(block);
            return colors(block.area_deprivation_index_percent)
          }
          return "rgb(240, 240, 255)";
        })
        // When the mouse moves over a feature, show the tooltip.
        .on('mousemove', showTooltip)
        // When the mouse moves out of a feature, hide the tooltip.
        .on('mouseout', hideTooltip)
        // click to show details
        .on('mousedown', showSidebar);

    });
    
    function zoomed() { 
        svg.selectAll('path').attr('transform', d3.event.transform);
    }

    const zoom = d3.zoom().scaleExtent([1, 20]).on('zoom', zoomed);
    svg.call(zoom);

    ///////////////////////////////////////////////////////////////////////
    // Sidebar
    ///////////////////////////////////////////////////////////////////////

    function showSidebar(f) {
      if( !evictions_by_geoid || !adi) {
        return;
      }

      // Get the current mouse position (as integer)
      var mouse = d3.mouse(d3.select(element).node()).map(
        function(d) { return parseInt(d); }
      );

      var cb = adi.find(e => (e.geoid2 == f.properties.GEOID));
      //var cb_data = all_data_by_geoid.find(e => (e.GEOID == cb.tract));
      var cb_data = [];
      for(row in all_data_by_geoid){
        //console.log(row);
        if(all_data_by_geoid[row].GEOID == cb.tract) {
          cb_data.push({filings:all_data_by_geoid[row].filings_2020, 
            date:d3.timeParse("%Y-%m-%d")(all_data_by_geoid[row].week_date)});
        }
      }

      //console.log(cb_data);

      var margin = {top: 10, right: 10, bottom: 50, left: 30},
        width = 300 - margin.left - margin.right,
        height = 280 - margin.top - margin.bottom;

      d3.select("#map_2_sidebar").selectAll('*').remove();

      var header = d3.select("#map_2_sidebar").append("p").text("Census Block: " + f.properties.GEOID + "<br/> Racial Majority: " + cb.racial_majority);

      // append the svg object to the body of the page
      var sidebar_svg = d3.select("#map_2_sidebar")
        .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
        .append("g")
          .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

      var x = d3.scaleTime()
        .domain(d3.extent(cb_data, function(d) { return d.date; }))
        .range([ 0, width ]);
      var x_axis = sidebar_svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(
            d3.axisBottom(x).tickFormat(function(date){
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
          .attr("transform", "rotate(-65)" );

      // Add Y axis
      var y = d3.scaleLinear()
        .domain([0, 15])
        .range([ height, 0 ]);
      var y_axis = sidebar_svg.append("g").call(d3.axisLeft(y));

      y_axis.selectAll("text").style("color", "#000");

      x_axis.selectAll("line").style("stroke","#000");
      x_axis.selectAll("path").style("stroke","#000");
      y_axis.selectAll("line").style("stroke","#000");
      y_axis.selectAll("path").style("stroke","#000");

      // Add the line
      sidebar_svg.append("path")
        .datum(cb_data)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function(d) { return x(d.date) })
          .y(function(d) { return y(d.filings) })
        )

    }

    ///////////////////////////////////////////////////////////////////////
    // Tooltip
    ///////////////////////////////////////////////////////////////////////

    var tooltip = d3.select(element)
      .append("div")
      .attr("class", "d3tooltip hidden");

    function showTooltip(f) {

      if( !evictions_by_geoid || !adi) {
        return;
      }

      var scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop

      // Get the current mouse position (as integer)
      var mouse = d3.mouse(d3.select('#map').node()).map(
        function(d) { return parseInt(d); }
      );

      // Calculate the absolute left and top offsets of the tooltip. If the
      // mouse is close to the right border of the map, show the tooltip on
      // the left.
      var left = Math.min(w - 4 * f.properties.NAMELSAD.length, mouse[0] + 5);
      var top = mouse[1] + (scrollTop/12);
      
      var cb = adi.find(e => (e.geoid2 == f.properties.GEOID));
      var evictions = evictions_by_geoid.find(e => (e.geoid == cb.tract));
      //console.log(city);
      var tooltipHTML = "";
      if(evictions != null ) {
        tooltiphtml = "BroadStreet ADI: " + cb.area_deprivation_index_percent + "<br/> Average Eviction Filings Per Year: " + parseFloat(evictions.average_filings).toFixed(2);
      } else if(cb != null && cb.area_deprivation_index_percent != "") {
        tooltiphtml = "BroadStreet ADI: " + cb.area_deprivation_index_percent;
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

function by_weeks_viz(element, legend)
{

  //Width and height
  var w = 800;
  var h = 600;

  //Define map projection
  var projection = d3.geoMercator()
                          .center([ -82.99, 40.37 ])
                          .scale([ 10 * w ])
                          .translate([ w/2, h/2 ]);
                        
  // Define nicer colors
  var colors = d3.scaleSequential(d3.interpolatePlasma).domain([0, 6])

  //Define path generator
  var path = d3.geoPath().projection(projection);

  //Create SVG
  var svg = d3.select(element)
              .append("svg")
              .attr("width", w)
              .attr("height", h);

  var cities = null;
  var weeks = [];

  var colors_for_legend = [{label:"Below Average", color:"#0D0887"}, 
				      {label:"100% of Average", color:"#7E03A8"}, 
				      {label:"200% of Average", color:"#CC4778"}, 
				      {label:"300% of Average", color:"#F89540"}, 
				      {label:"> 300% of Average", color:"#FDC527"}];


  var legend = d3.select(legend).append("svg").attr("width", 200).attr("height", 500);

  // Add one dot in the legend for each name.
  legend.selectAll("mydots")
    .data(colors_for_legend)
    .enter()
    .append("circle")
      .attr("cx", 10)
      .attr("cy", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
      .attr("r", 7)
      .style("fill", function(d){ return d.color})

  // Add one dot in the legend for each name.
  legend.selectAll("mylabels")
    .data(colors_for_legend)
    .enter()
    .append("text")
      .attr("x", 20)
      .attr("font-size", 12)
      .attr("y", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
      .style("fill", function(d){ return d.color})
      .text(function(d){ return d.label})
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle");

  function week_formatter(date) {
  	var d = new Date(date);
  	var month = d.toLocaleString('default', { month: 'short' });
  	return month.toString() + " " + d.getFullYear().toString().substring(2,4);
  }

  d3.csv("data/cities_weekly_2020_2021.csv").then(res => {
    cities = res;
    weeks = [... new Set(cities.map(data => data.week_date))]

    ////////////////////////////////////////////////////////////////////
    // build the slidr
    ////////////////////////////////////////////////////////////////////

    $( function() {
	    $( "#slider" ).slider({
	    	height:50,
	    	width:800,
				min: 1,
				max: weeks.length,
				slide: function (event, ui) {
					svg.selectAll("path")
					  .attr("fill", 
					  	function(d,i) {
					        var geoid = d.properties.GEOID;
					        var city = cities.find(e => (e.GEOID == geoid && e.week == ui.value));
					        if(city != null) {
					        	return colors(city.filings_2020 / Math.max(1.0, city.filings_avg))
					        } else {
					        	return "none";
					        }
						}
					);
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
			    for (var i = 0; i <= vals; i+=5) {
			        // Create a new element and position it with percentages
			        var el = $('<li>' + week_formatter(weeks[(i + opt.min)]) + '</li>').css('left', (i/vals*100) + '%');
			        // Add the element inside #slider
			        $("#slider_labels").append(el);
			     }

			   });
    	});
    	d3.select('#value').text("Week of " + weeks[1]);
  });

  var ohio_json = {};
  var current_week = 1;

  //Load in GeoJSON data
  d3.json("geojson/ohio_cities.json").then(res =>  {

    ohio_json = res;

    ohio_json['features'].forEach(function(feature) {
     if(feature.geometry.type == "MultiPolygon") {
       feature.geometry.coordinates.forEach(function(polygon) {

         polygon.forEach(function(ring) {
           ring.reverse();
         })
       })
     }
     else if (feature.geometry.type == "Polygon") {
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
      .attr("stroke", function(d,i) {
        var geoid = d.properties.GEOID;

        // is it the outline of the state?
        if(geoid == "0400000US39") {
        	return "#999999";
        }

        var city = cities.find(e => (e.GEOID == geoid && e.week == current_week));
        if(city != null) {
          return "dimgray"
        }
        return "none";
      })
      .attr("stroke-width",function(d,i) {
      	var geoid = d.properties.GEOID;

        // is it the outline of the state?
        if(geoid == "0400000US39") {
        	return "1.0";
        } else {
        	return "0.1";
        }
      })
      .attr("fill", function(d,i) {
        var geoid = d.properties.GEOID;
        var city = cities.find(e => (e.GEOID == geoid && e.week == current_week));
        if(city != null) {
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
      function(d) { return parseInt(d); }
    );

    // Calculate the absolute left and top offsets of the tooltip. If the
    // mouse is close to the right border of the map, show the tooltip on
    // the left.
    var left = Math.min(w - 4 * f.properties.NAMELSAD.length, mouse[0] + 5);
    var top = scrollTop + mouse[1] + 25;

    var city = cities.find(e => (e.GEOID == f.properties.GEOID && e.week == current_week));
    var tooltipHTML = "";
    if(city != null ) {
      tooltiphtml = "Average weekly evictions: " + 
        parseFloat(city.filings_avg).toFixed(2)  + 
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
