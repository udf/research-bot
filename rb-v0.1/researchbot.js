const vernum    = "v0.1";
const verdate   = "16.02.2018";
const vername   = "Researchbot";
const shortname = "rb";
const release   = true;

const reserve_power = 1000;
const upgradables = [
	{struct: "A0ResearchModule1", target: "A0ResearchFacility", count: 1},
	{struct: "A0PowMod1", target: "A0PowerGenerator", count: 1},
	{struct: "A0FacMod1", target: "A0LightFactory", count: 2},
	{struct: "A0FacMod1", target: "A0VTolFactory1", count: 2},
];
need_more_derricks = true;

g_idle_constructors = []

function log() {
	debug(Array.prototype.join.call(arguments, ' '));
}

function chat_all(str) {
	playerData.forEach(function(player, player_id) {
		if (player.isHuman)
			chat(player_id, str);
	});
}

function get_idle_droids(type) {
	var not_idle = [
		DORDER_BUILD,     // building
		DORDER_HELPBUILD, // building
		DORDER_LINEBUILD, // building
		DORDER_DEMOLISH,  // demolishing
		DORDER_REPAIR,    // repairing a building
		DORDER_RTR,       // getting repaired
		DORDER_RECYCLE,   // getting recycled (not sure about this one)
		DORDER_SCOUT      // scouting
	];
	var droids = enumDroid(me, type);
	return droids.filter(function(droid) {
		return (not_idle.indexOf(droid.order) == -1);
	});
}

function get_idle_droid(type) {
	if (g_idle_constructors.length == 0)
		return undefined;
	return g_idle_constructors.shift();
}

function try_build(structure, near) {
	if (playerPower(me) <= 100) return false;
	if (g_idle_constructors.length == 0) return false;
	if (!isStructureAvailable(structure)) return false;
	var pos = pickStructLocation(g_idle_constructors[0], structure, near.x, near.y);
	if (!pos) return false;
	var success = orderDroidBuild(
		g_idle_constructors[0],
		DORDER_BUILD,
		structure,
		pos.x,
		pos.y
	);
	if (success)
		g_idle_constructors.shift();
	return success;
}

function get_closest_to_droid(droid, objs) {
	objs = objs.filter(
		function(obj) {
			return droidCanReach(droid, obj.x, obj.y);
		}
	);
	if (objs.length == 0) return undefined;
	var dists = objs.map(
		function(obj) {
			return distBetweenTwoPoints(droid.x, droid.y, obj.x, obj.y);
		}
	);
	var best_i = 0;
	for (var i = 1; i < objs.length; i++) {
		if (dists[i] < dists[best_i]) {
			best_i = i;
		}
	}
	return {
		droid: droid,
		obj: objs[best_i],
		dist: dists[best_i]
	};
}

function get_idle_structs() {
	var structs = []
	for (var i = 0; i < arguments.length; i++) {
		enumStruct(me, arguments[i]).forEach(
			function(struct) {
				if ((struct.status == BUILT) && structureIdle(struct))
					structs.push(struct);
			}
		);
	}
	return structs;
}

function build_constructor(factory) {
	if (playerPower(me) <= 100) return;
	switch(factory.stattype) {
	case CYBORG_FACTORY:
		return buildDroid(
			factory,
			"constructor",
			"Cyb-Bod-ComEng",
			"CyborgLegs",
			null,
			null,
			"CyborgSpade"
		);
	case FACTORY:
		return buildDroid(
			factory,
			"constructor",
			["Body3MBT", "Body2SUP", "Body4ABT", "Body1REC"],
			["hover01", "wheeled01"],
			null,
			null,
			"Spade1Mk1"
		);
	default:
		log("build_constructor: invalid factory")
		return false;
	}
}

// builds a derrick on the closest spot from any droid
function build_derrick() {
	var oils = enumFeature(ALL_PLAYERS, "OilResource");
	if (g_idle_constructors.length <= 0)
		return false;
	if (oils.length <= 0) {
		chat_all("AAAAAAAAaAAAAAAAAAAaaaaAAAAAAAAAAaaa");
		return true;
	}

	var targets = g_idle_constructors.map(
		function(droid) {
			return get_closest_to_droid(droid, oils);
		}
	);
	var best = targets[0];
	for (var i = 1; i < targets.length; i++) {
		if (targets[i] && targets[i].dist < best.dist) {
			best = targets[i];
		}
	}
	if (best) {
		var ret = orderDroidBuild(
			best.droid,
			DORDER_BUILD,
			"A0ResourceExtractor",
			best.obj.x,
			best.obj.y
		);
		if (ret) {
			g_idle_constructors = g_idle_constructors.filter(function(droid) {
				return droid != best.droid;
			});
		}
	} else {
		chat_all("AAAAAAAAaAAAAAAAAAAaaaaAAAAAAAAAAaaa");
	}
	return true;
}

function ensure_constructors() {
	var num_droids = countDroid(DROID_CONSTRUCT);
	var max_droids = getDroidLimit(me, DROID_CONSTRUCT);
	var num_needed = max_droids - num_droids;
	if (num_needed > 0) {
		var idle_factories = get_idle_structs("A0LightFactory", "A0CyborgFactory");
		for (var i = 0; i < Math.min(num_needed, idle_factories.length); i++) {
			build_constructor(idle_factories[i])
		}
	}
	return num_droids > 0;
}

function ensure_hq() {
	if (countStruct("A0CommandCentre") <= 0) {
		try_build("A0CommandCentre", enumDroid(me, DROID_CONSTRUCT)[0]);
		return false;
	}
	return true;
}

function ensure_power() {
	var HQ = enumStruct(me, "A0CommandCentre")[0];
	// build power gen if we dont have
	if (countStruct("A0PowerGenerator") <= 0) {
		try_build("A0PowerGenerator", HQ);
		return false;
	}

	// build more derricks if the economy manager says we should
	if (need_more_derricks) {
		if (build_derrick())
			need_more_derricks = false;
	}

	// build more gens if not enough gens to satisfy derricks
	var num_gens = countStruct("A0PowerGenerator");
	var num_derricks = countStruct("A0ResourceExtractor");
	if (num_derricks > num_gens * 4) {
		try_build("A0PowerGenerator", HQ);
	}
	return true;
}

function enumUpgradable() {
	var upgradable = [];
	upgradables.forEach(function(upgrade) {
		if (!isStructureAvailable(upgrade.struct))
			return;
		enumStruct(me, upgrade.target).forEach(function(target) {
			if (target.modules < upgrade.count) {
				upgradable.push({target: target, name: upgrade.struct});
			}
		});
	});
	return upgradable;
}

function manage_constructors() {
	var HQ = enumStruct(me, "A0CommandCentre")[0];
	if (g_idle_constructors.length == 0) return;

	// try to upgrade various buildings
	var upgradable = enumUpgradable();
	if (upgradable.length > 0) {
		var upgrade = upgradable[0];
		orderDroidBuild(
			g_idle_constructors.shift(),
			DORDER_BUILD,
			upgrade.name,
			upgrade.target.x,
			upgrade.target.y
		);
	}

	if (g_idle_constructors.length == 0) return;

	// find buildings that are being built and make idle droids help
	var building_sites = enumStruct(me).filter(function(struct) {
		return struct.status == BEING_BUILT && struct.stattype != RESOURCE_EXTRACTOR;
	});
	for (var i = 0; i < building_sites.length; i++) {
		if (g_idle_constructors.length == 0)
			return;
		var ret = orderDroidObj(g_idle_constructors.shift(), DORDER_HELPBUILD, building_sites[i]);
	}

	if (g_idle_constructors.length == 0) return;

	// build factory if we dont have enough
	if (countStruct("A0LightFactory") + countStruct("A0CyborgFactory") < 2) {
		if (!try_build("A0LightFactory", HQ)) {
			try_build("A0CyborgFactory", HQ);
		}
	}
}

function manage_research() {
	var HQ = enumStruct(me, "A0CommandCentre")[0];

	// try to build more research facilities
	try_build("A0ResearchFacility", HQ);

	if (playerPower(me) <= 100) return;

	// research stuff
	var idle_labs = enumStruct(me, RESEARCH_LAB).filter(function(lab) {
		return lab.status == BUILT && structureIdle(lab);
	});
	if (idle_labs.length == 0) return;

	// pursue imporant tech
	var targets = [
		"R-Struc-PowerModuleMk1", "R-Struc-Research-Module", "R-Struc-Factory-Module",
		"R-Vehicle-Prop-Hover", "R-Struc-Power-Upgrade03a", "R-Struc-Research-Upgrade09"
	];
	while (targets.length && idle_labs.length) {
		if (pursueResearch(idle_labs[0], targets.shift()))
			idle_labs.shift();
	}
	// stop if we dont have any idle labs, or too little power
	if (idle_labs.length == 0) return;
	if (playerPower(me) <= 250) return;

	// pursue everything else
	targets = enumResearch().map(function(research) { return research.name; });
	while (targets.length && idle_labs.length) {
		if (pursueResearch(idle_labs[0], targets.shift()))
			idle_labs.shift();
	}
}

function recycle_old_construtors() {
	if (!getResearch("R-Vehicle-Prop-Hover").done)
		return;

	g_idle_constructors.forEach(function(droid) {
		if (droid.propulsion != "hover01")
			orderDroid(droid, DORDER_RECYCLE);
	});
}

function mainloop() {
	g_idle_constructors = get_idle_droids(DROID_CONSTRUCT);
	if (!ensure_constructors())
		return;
	if (!ensure_hq())
		return;
	if (!ensure_power())
		return;
	manage_constructors();
	manage_research();
	recycle_old_construtors();
}

manage_eco = function() {
	var last_power = 0;
	return function() {
		// TODO communist it up

		var power = playerPower(me);
		// if we lost power since the last call and we are below the threshhold,
		// set a flag so that ensure_power() can try to build another derrick
		if (power <= 0 || (power < last_power && power <= reserve_power)) {
			need_more_derricks = true;
		}
		last_power = power;
	}
}();

function eventStartLevel() {
	setTimer("mainloop", 1000);
	setTimer("manage_eco", 15000);
}
