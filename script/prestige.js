var Prestige = {
		
	name: 'Prestige',

	options: {},

	init: function(options) {
		this.options = $.extend(this.options, options);
	},
	
	storesMap: {
		'crystal': 'g',
		'wood': 'g',
		'fur': 'g',
		'meat': 'g',
		'iron': 'g',
		'coal': 'g',
		'sulphur': 'g',
		'steel': 'g',
		'cured meat': 'g',
		'scales': 'g',
		'teeth': 'g',
		'leather': 'g',
		'bait': 'g',
		'torch': 'g',
		'cloth': 'g',
		'bone spear': 'w',
		'iron sword': 'w',
		'steel sword': 'w',
		'bayonet': 'w',
		'rifle': 'w',
		'laser rifle': 'w',
		'bullets': 'a',
		'energy cell': 'a',
		'grenade': 'a',
		'bolas': 'a'
	},
	// Frozen order for saves made before item IDs replaced positional arrays.
	legacyStoreOrder: ['wood', 'fur', 'meat', 'iron', 'coal', 'sulphur', 'steel', 'cured meat', 'scales', 'teeth', 'leather', 'bait', 'torch', 'cloth', 'bone spear', 'iron sword', 'steel sword', 'bayonet', 'rifle', 'laser rifle', 'bullets', 'energy cell', 'grenade', 'bolas'],
	getStores: function(reduce) {
		var stores = {};
		Object.keys(this.storesMap).forEach(key => {
			stores[key] = Math.floor($SM.get('stores["' + key + '"]', true) /
				(reduce ? this.randGen(this.storesMap[key]) : 1));
		});
		return stores;
	},

	get: function() {
		return {
			stores: $SM.get('previous.stores'),
			caches: Prestige.getCaches(),
			score: $SM.get('previous.score')
		};
	},
	
	set: function(prestige) {
		$SM.set('previous.stores', prestige.stores);
		$SM.set('previous.caches', prestige.caches || []);
		$SM.set('previous.score', prestige.score);
	},
	
	save: function() {
		var stores = this.getStores(true);
		var caches = Prestige.getCaches().slice(-4);
		caches.push({ stores: stores });
		$SM.set('previous.caches', caches, true);
		$SM.set('previous.stores', stores);
		$SM.set('previous.score', Score.totalScore());
	},
  
	getCaches: function() {
		var caches = $SM.get('previous.caches');
		if(Array.isArray(caches) && caches.length) return caches.slice(-5);
		var legacy = $SM.get('previous.stores');
		return legacy && Object.keys(legacy).length ? [{ stores: legacy }] : [];
	},

	cacheStores: function(previous) {
		var result = {};
		Object.keys(this.storesMap).forEach(function(key) {
			var value = Array.isArray(previous) ? previous[Prestige.legacyStoreOrder.indexOf(key)] : previous[key];
			if(Number.isFinite(value) && value > 0) result[key] = value;
		});
		return result;
	},

	redeemCaches: function() {
		var committed = $SM.get('game.world.cacheClaims') || {};
		var claims = World.state.cacheClaims || {};
		var caches = Prestige.getCaches();
		Object.keys(claims).forEach(function(index) {
			if(claims[index] && !committed[index] && caches[index]) {
				$SM.addM('stores', Prestige.cacheStores(caches[index].stores), true);
			}
		});
	},

	collectStores: function() {
		if(World.state && World.curPos) {
			var sites = World.mapSearch(World.TILE.CACHE, World.state.map);
			var index = sites.findIndex(function(p) { return p.x === World.curPos[0] && p.y === World.curPos[1]; });
			if(index < 0 || !Prestige.getCaches()[index]) return;
			var claims = World.state.cacheClaims || (World.state.cacheClaims = {});
			if(!claims[index]) {
				claims[index] = true;
				Notifications.notify(World, _('the old stores are sealed for the journey home. return safely to recover them.'));
			}
			return;
		}
		// Legacy direct collection, outside a world expedition.
		var previous = $SM.get('previous.stores');
		if (!previous) return;
		var toAdd = {};
		Object.keys(this.storesMap).forEach(key => {
			var value = Array.isArray(previous) ? previous[this.legacyStoreOrder.indexOf(key)] : previous[key];
			if (Number.isFinite(value) && value > 0) toAdd[key] = value;
		});
		$SM.addM('stores', toAdd, true);
		$SM.set('previous.stores', {});
		$SM.fireUpdate('stores');
	},

	randGen : function(storeType) {
		var amount;
		switch(storeType) {
		case 'g':
			amount = Math.floor(Math.random() * 10);
			break;
		case 'w':
			amount = Math.floor(Math.floor(Math.random() * 10) / 2);
			break;
		case 'a':
			amount = Math.ceil(Math.random() * 10 * Math.ceil(Math.random() * 10));
			break;
		default:
			return 1;
		}
		if (amount !== 0) {
			return amount;
		}
		return 1;
	}

};
