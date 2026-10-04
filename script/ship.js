/**
 * Module that registers the starship!
 */
var Ship = {
	LIFTOFF_COOLDOWN: 120,
	ALLOY_PER_HULL: 1,
	ALLOY_PER_THRUSTER: 1,
	BASE_HULL: 0,
	BASE_THRUSTERS: 1,
	LATTICE_COST: { 'lattice shard': 1, crystal: 4, steel: 10, sulphur: 20, 'energy cell': 3, 'alien alloy': 1 },
	LATTICE_STATES: [_('dark'), _('fractured'), _('aligned'), _('awake')],
	name: _("Ship"),
	init: function(options) {
		this.options = $.extend(
			this.options,
			options
		);
		
		if(!$SM.get('features.location.spaceShip')) {
			$SM.set('features.location.spaceShip', true);
			$SM.setM('game.spaceShip', {
				hull: Ship.BASE_HULL,
				thrusters: Ship.BASE_THRUSTERS,
				lattice: 0
			});
		}
		
		// Create the Ship tab
		this.tab = Header.addLocation(_("An Old Starship"), "ship", Ship);
		
		// Create the Ship panel
		this.panel = $('<div>').attr('id', "shipPanel")
			.addClass('location')
			.appendTo('div#locationSlider');
		
		Engine.updateSlider();
		
		// Draw the hull label
		var hullRow = $('<div>').attr('id', 'hullRow').appendTo('div#shipPanel');
		$('<div>').addClass('row_key').text(_('hull:')).appendTo(hullRow);
		$('<div>').addClass('row_val').text($SM.get('game.spaceShip.hull')).appendTo(hullRow);
		$('<div>').addClass('clear').appendTo(hullRow);
		
		// Draw the thrusters label
		var engineRow = $('<div>').attr('id', 'engineRow').appendTo('div#shipPanel');
		$('<div>').addClass('row_key').text(_('engine:')).appendTo(engineRow);
		$('<div>').addClass('row_val').text($SM.get('game.spaceShip.thrusters')).appendTo(engineRow);
		$('<div>').addClass('clear').appendTo(engineRow);
		
		// Draw the guidance lattice and its repair requirements.
		var latticeRow = $('<div>').attr('id', 'latticeRow').appendTo(Ship.panel);
		$('<div>').addClass('row_key').text(_('guidance lattice:')).appendTo(latticeRow);
		$('<div>').addClass('row_val').appendTo(latticeRow);
		$('<div>').addClass('clear').appendTo(latticeRow);
		$('<div>').attr('id', 'latticeHint').appendTo(Ship.panel);
		new Button.Button({
			id: 'latticeButton', text: _('repair lattice'), click: Ship.repairLattice,
			width: '150px', cost: Ship.LATTICE_COST
		}).appendTo(Ship.panel);

		new Button.Button({
			id: 'reinforceButton',
			text: _('reinforce hull'),
			click: Ship.reinforceHull,
			width: '100px',
			cost: {'alien alloy': Ship.ALLOY_PER_HULL}
		}).appendTo('div#shipPanel');
		
		// Draw the engine button
		new Button.Button({
			id: 'engineButton',
			text: _('upgrade engine'),
			click: Ship.upgradeEngine,
			width: '100px',
			cost: {'alien alloy': Ship.ALLOY_PER_THRUSTER}
		}).appendTo('div#shipPanel');
		
		// Draw the lift off button
		var b = new Button.Button({
			id: 'liftoffButton',
			text: _('lift off'),
			click: Ship.checkLiftOff,
			width: '100px',
			cooldown: Ship.LIFTOFF_COOLDOWN
		}).appendTo('div#shipPanel');
		
		if($SM.get('game.spaceShip.hull') <= 0) {
			Button.setDisabled(b, true);
		}
		
		// Init Space
		Space.init();
		
		//subscribe to stateUpdates
		$.Dispatch('stateUpdate').subscribe(Ship.handleStateUpdates);
		Ship.updateLattice();
	},
	
	options: {}, // Nothing for now
	
	onArrival: function(transition_diff) {
		Ship.setTitle();
		if(!$SM.get('game.spaceShip.seenShip')) {
			Notifications.notify(Ship, _('somewhere above the debris cloud, the wanderer fleet hovers. been on this rock too long.'));
			$SM.set('game.spaceShip.seenShip', true);
		}
		AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_SHIP);

		Engine.moveStoresView(null, transition_diff);
	},
	
	setTitle: function() {
		if(Engine.activeModule == this) {
			document.title = _("An Old Starship");
		}
	},
	
	reinforceHull: function() {
		if($SM.get('stores["alien alloy"]', true) < Ship.ALLOY_PER_HULL) {
			Notifications.notify(Ship, _("not enough alien alloy"));
			return false;
		}
		$SM.add('stores["alien alloy"]', -Ship.ALLOY_PER_HULL);
		$SM.add('game.spaceShip.hull', 1);
		Ship.updateLattice();
		$('#hullRow .row_val', Ship.panel).text($SM.get('game.spaceShip.hull'));
		AudioEngine.playSound(AudioLibrary.REINFORCE_HULL);
	},
	
	upgradeEngine: function() {
		if($SM.get('stores["alien alloy"]', true) < Ship.ALLOY_PER_THRUSTER) {
			Notifications.notify(Ship, _("not enough alien alloy"));
			return false;
		}
		$SM.add('stores["alien alloy"]', -Ship.ALLOY_PER_THRUSTER);
		$SM.add('game.spaceShip.thrusters', 1);
		$('#engineRow .row_val', Ship.panel).text($SM.get('game.spaceShip.thrusters'));
		AudioEngine.playSound(AudioLibrary.UPGRADE_ENGINE);
	},
	
	getMaxHull: function() {
		return $SM.get('game.spaceShip.hull', true);
	},

	canLiftOff: function() {
		return $SM.get('game.spaceShip.hull', true) > 0 && $SM.get('game.spaceShip.lattice') === 3;
	},

	canRepairLattice: function() {
		var stage = $SM.get('game.spaceShip.lattice', true);
		return stage >= 0 && stage < 3 && $SM.get('features.location.fabricator') &&
			$SM.get('features.industry.etching') && (stage < 2 || $SM.get('features.industry.assembly')) &&
			Object.keys(Ship.LATTICE_COST).every(key => $SM.get('stores["' + key + '"]', true) >= Ship.LATTICE_COST[key]);
	},

	repairLattice: function() {
		if (!Ship.canRepairLattice()) return false;
		// Suppress saves and observers until both inventory and stage have changed.
		var changes = {};
		Object.keys(Ship.LATTICE_COST).forEach(key => { changes[key] = -Ship.LATTICE_COST[key]; });
		$SM.addM('stores', changes, true);
		$SM.add('game.spaceShip.lattice', 1, true);
		Engine.saveGame();
		$SM.fireUpdate('stores');
		$SM.fireUpdate('game.spaceShip');
		Notifications.notify(Ship, $SM.get('game.spaceShip.lattice') === 3 ?
			_('light moves through the crystal. the ship remembers the sky.') : _('another broken line carries light.'));
		return true;
	},

	updateLattice: function() {
		var stage = $SM.get('game.spaceShip.lattice', true);
		$('#latticeRow .row_val', Ship.panel).text(Ship.LATTICE_STATES[stage]);
		var hint = '';
		if (stage < 3) {
			if (!$SM.get('features.location.fabricator')) hint = _('a wanderer device could join the broken lines.');
			else if (!$SM.get('features.industry.etching')) hint = _('the crystal needs the tools of an old chemical works.');
			else if (stage === 2 && !$SM.get('features.industry.assembly')) hint = _('the final lattice needs a precision frame.');
			else hint = _('the engines answer. the ship does not know where to go.');
		}
		$('#latticeHint', Ship.panel).text(hint);
		Button.setDisabled($('#latticeButton', Ship.panel), !Ship.canRepairLattice());
		Button.setDisabled($('#liftoffButton', Ship.panel), !Ship.canLiftOff());
	},
	
	checkLiftOff: function() {
		if (!Ship.canLiftOff()) {
			Notifications.notify(Ship, _('the engines answer. the ship does not know where to go.'));
			Button.clearCooldown($('#liftoffButton'));
			return false;
		}
		if(!$SM.get('game.spaceShip.seenWarning')) {
			Events.startEvent({
				title: _('Ready to Leave?'),
				scenes: {
					'start': {
						text: [
							_("time to get out of this place. won't be coming back.")
						],
						buttons: {
							'fly': {
								text: _('lift off'),
								onChoose: function() {
									$SM.set('game.spaceShip.seenWarning', true);
									Ship.liftOff();
								},
								nextScene: 'end'
							},
							'wait': {
								text: _('linger'),
								onChoose: function() {
									Button.clearCooldown($('#liftoffButton'));
								},
								nextScene: 'end'
							}
						}
					}
				}
			});
		} else {
			Ship.liftOff();
		}
	},
	
	liftOff: function () {
		if (!Ship.canLiftOff()) return false;
		$('#outerSlider').animate({top: '700px'}, 300);
		Space.onArrival();
		Engine.setActiveModule(Space);
		AudioEngine.playSound(AudioLibrary.LIFT_OFF);
	},
	
	handleStateUpdates: function(e){
		Ship.updateLattice();
	}
};
