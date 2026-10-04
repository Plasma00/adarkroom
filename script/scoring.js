var Score = {

	name : 'Score',

	options : {},

	init : function(options) {
		this.options = $.extend(this.options, options);
	},

	weights: {
		'wood': 1,
		'fur': 1.5,
		'meat': 1,
		'iron': 2,
		'coal': 2,
		'sulphur': 3,
		'steel': 3,
		'cured meat': 2,
		'scales': 2,
		'teeth': 2,
		'leather': 2,
		'bait': 1.5,
		'torch': 1,
		'cloth': 1,
		'bone spear': 10,
		'iron sword': 30,
		'steel sword': 50,
		'bayonet': 100,
		'rifle': 150,
		'laser rifle': 150,
		'bullets': 3,
		'energy cell': 3,
		'grenade': 5,
		'bolas': 4,
		'alien alloy': 10, 'fleet beacon': 500, crystal: 5
	},
	calculateScore: function() {
		var total = Object.keys(Score.weights).reduce((sum, key) =>
			sum + $SM.get('stores["' + key + '"]', true) * Score.weights[key], 0);
		return Math.floor(total + Ship.getMaxHull() * 50);
	},

	save: function() {
		$SM.set('playStats.score', Score.calculateScore());
	},

	totalScore : function() {
		return $SM.get('previous.score', true) + Score.calculateScore();
	}
};
