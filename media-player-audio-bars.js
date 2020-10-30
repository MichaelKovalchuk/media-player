import { css, html, LitElement } from 'lit-element/lit-element.js';
import { styleMap } from 'lit-html/directives/style-map';
import ResizeObserver from 'resize-observer-polyfill';

const AUDIO_BARS_GRADIENTS = [
	{
		from: '29A6FF',
		weight: 171
	},
	{
		from: '29A6FF',
		weight: 8
	},
	{
		from: '00D2ED',
		weight: 9
	},
	{
		from: '2DE2C0',
		weight: 2
	}
];
const AUDIO_BARS_GRADIENTS_TOTAL_WEIGHT = AUDIO_BARS_GRADIENTS.reduce((runningTotal, gradient) => {
	return runningTotal + gradient.weight
}, 0);
AUDIO_BARS_GRADIENTS.forEach((gradient, i) => {
	gradient.fractionPassedNonInclusive = 0;
	gradient.fractionPassedInclusive = gradient.weight / AUDIO_BARS_GRADIENTS_TOTAL_WEIGHT;

	if (i > 0) {
		gradient.fractionPassedNonInclusive = AUDIO_BARS_GRADIENTS[i - 1].fractionPassedInclusive;
		gradient.fractionPassedInclusive += gradient.fractionPassedNonInclusive;
	}

	if (i < AUDIO_BARS_GRADIENTS.length - 1) {
		gradient.to = AUDIO_BARS_GRADIENTS[i + 1].from;
	} else {
		gradient.to = AUDIO_BARS_GRADIENTS[0].from;
	}
});

const AUDIO_BAR_HORIZONTAL_MARGIN_REM = 0.1;
const AUDIO_BAR_WIDTH_REM = 0.25;
const FULL_BYTE = 255;
const GAMMA = 0.43;
const GAMMA_ADJUSTMENT_EXPONENT = 2.4;
const LINEAR_OFFSET = 0.055;
const UNDER_LINEAR_THRESHOLD_FACTOR = 12.92;
const UPDATE_PERIOD_MS = 50;

class MediaPlayerAudioBars extends LitElement {
	static get properties() {
		return {
			_audioBars: { type: Array, attribute: false },
			playing: { type: Boolean }
		};
	}

	static get styles() {
		return css`
			#d2l-labs-media-player-audio-bars-row {
				display: flex;
				flex-direction: row;
				height: 100%;
			}

			#d2l-labs-media-player-audio-bar-container {
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			.d2l-labs-media-player-audio-bar {
				margin: 0 ${AUDIO_BAR_HORIZONTAL_MARGIN_REM}rem;
				width: ${AUDIO_BAR_WIDTH_REM}rem;
			}
		`;
	}

	constructor() {
		super();

		this._audioBars = [];
		this._changingAudioBarsInterval = null;
	}

	render() {
		return html`
			<div id="d2l-labs-media-player-audio-bars-row">
				${this._audioBars.map(audioBar => html`
					<div id="d2l-labs-media-player-audio-bar-container">
						<div style="flex: auto;"></div>
						<div class="d2l-labs-media-player-audio-bar" style=${styleMap({ backgroundColor: `rgba(${audioBar.red}, ${audioBar.green}, ${audioBar.blue}, 1)`, height: `${audioBar.height}%` })}></div>
					</div>
				`)}
			</div>
		`;
	}

	firstUpdated(changedProperties) {
		super.firstUpdated(changedProperties);

		new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width } = entry.contentRect;

				const fontSize = getComputedStyle(document.documentElement).fontSize;
				const pxPerRem = fontSize.substr(0, fontSize.indexOf('px'));

				const audioBarWidthPx = AUDIO_BAR_WIDTH_REM * pxPerRem;
				const audioBarHorizontalMarginPx = AUDIO_BAR_HORIZONTAL_MARGIN_REM * pxPerRem;
				const numAudioBars = Math.floor(width / (audioBarWidthPx + 2 * audioBarHorizontalMarginPx));

				this._audioBars = [];
				for (let i = 0; i < numAudioBars; i++) {
					this._audioBars.push({
						blue: 0,
						green: 0,
						red: 0,
						height: Math.round(Math.random() * 70 + 30)
					});
				}

				this._startChangingAudioBars();
			}
		}).observe(this);
	}

	_startChangingAudioBars() {
		this._audioBarsOffset = 0;

		this._changeColoursOfAudioBars();

		clearInterval(this._changingAudioBarsInterval);

		this._changingAudioBarsInterval = setInterval(() => {
			if (!this.playing) return;

			this._changeColoursOfAudioBars();
		}, UPDATE_PERIOD_MS);
	}

	_changeColoursOfAudioBars() {
		const newAudioBars = [];

		this._audioBars.forEach((audioBar, i) => {
			let newAudioBar = {};

			Object.keys(audioBar).forEach(key => newAudioBar[key] = audioBar[key]);

			newAudioBar = {
				...newAudioBar,
				...this._getRgbOfAudioBar(i)
			};

			newAudioBars.push(newAudioBar);
		});

		this._audioBars = newAudioBars;

		this._audioBarsOffset = this._audioBarsOffset === 0 ? this._audioBarsOffset = this._audioBars.length - 1 : this._audioBarsOffset - 1;
	}

	_getRgbOfAudioBar(i) {
		const iPosition = (i + this._audioBarsOffset) % this._audioBars.length
		const fraction = iPosition / this._audioBars.length;

		const { from, to, fractionPassedNonInclusive, fractionPassedInclusive } = MediaPlayerAudioBars._getGradientFromFraction(fraction);

		const innerFraction = (fraction - fractionPassedNonInclusive) / (fractionPassedInclusive - fractionPassedNonInclusive);

		const fromRedSRGB = parseInt(from.substr(0, 2), 16);
		const fromGreenSRGB = parseInt(from.substr(2, 2), 16);
		const fromBlueSRGB = parseInt(from.substr(4, 2), 16);
		const fromRedLinear = MediaPlayerAudioBars._fromSRGB(fromRedSRGB);
		const fromGreenLinear = MediaPlayerAudioBars._fromSRGB(fromGreenSRGB);
		const fromBlueLinear = MediaPlayerAudioBars._fromSRGB(fromBlueSRGB);
		const fromBrightness = Math.pow(fromRedLinear + fromGreenLinear + fromBlueLinear, GAMMA);

		const toRedSRGB = parseInt(to.substr(0, 2), 16);
		const toGreenSRGB = parseInt(to.substr(2, 2), 16);
		const toBlueSRGB = parseInt(to.substr(4, 2), 16);
		const toRedLinear = MediaPlayerAudioBars._fromSRGB(toRedSRGB);
		const toGreenLinear = MediaPlayerAudioBars._fromSRGB(toGreenSRGB);
		const toBlueLinear = MediaPlayerAudioBars._fromSRGB(toBlueSRGB);
		const toBrightness = Math.pow(toRedLinear + toGreenLinear + toBlueLinear, GAMMA);

		const brightness = Math.pow(MediaPlayerAudioBars._weightedAverage(fromBrightness, toBrightness, innerFraction), 1 / GAMMA);

		const redLinear = MediaPlayerAudioBars._weightedAverage(fromRedLinear, toRedLinear, innerFraction);
		const greenLinear = MediaPlayerAudioBars._weightedAverage(fromGreenLinear, toGreenLinear, innerFraction);
		const blueLinear = MediaPlayerAudioBars._weightedAverage(fromBlueLinear, toBlueLinear, innerFraction);

		const sumLinears = redLinear + greenLinear + blueLinear;

		const redLinearWithBrightness = redLinear * brightness / sumLinears;
		const greenLinearWithBrightness = greenLinear * brightness / sumLinears;
		const blueLinearWithBrightness = blueLinear * brightness / sumLinears;

		return {
			red: MediaPlayerAudioBars._toSRGB(redLinearWithBrightness),
			green: MediaPlayerAudioBars._toSRGB(greenLinearWithBrightness),
			blue: MediaPlayerAudioBars._toSRGB(blueLinearWithBrightness)
		};
	}

	static _getGradientFromFraction(fraction) {
		let gradientI = 0;
		for (; gradientI < AUDIO_BARS_GRADIENTS.length; gradientI++) {
			if (fraction <= AUDIO_BARS_GRADIENTS[gradientI].fractionPassedInclusive) return AUDIO_BARS_GRADIENTS[gradientI];
		}
	}

	/**
	 * Converts a [0..255] SRGB value to a [0..1] linear value.
	 * @param {Number} rgb SRGB representation of the colour.
	 * @returns {Number} Linear value of the colour.
	 */
	static _fromSRGB(rgb) {
		rgb /= FULL_BYTE;

		return rgb <= 0.04045 ? rgb / UNDER_LINEAR_THRESHOLD_FACTOR : Math.pow((rgb + LINEAR_OFFSET) / (1 + LINEAR_OFFSET), GAMMA_ADJUSTMENT_EXPONENT);
	}

	/**
	 * Converts a [0..1] linear value to a [0..255] SRGB value.
	 * @param {Number} rgb Linear representation of the colour.
	 * @returns {Number} SRGB value of the colour.
	 */
	static _toSRGB(rgb) {
		if (rgb <= 0.0031308) {
			rgb *= UNDER_LINEAR_THRESHOLD_FACTOR;
		} else {
			rgb = ((1 + LINEAR_OFFSET) * (Math.pow(rgb, 1 / GAMMA_ADJUSTMENT_EXPONENT))) - LINEAR_OFFSET;
		}

		return (FULL_BYTE + 1) * rgb;
	}

	static _weightedAverage(a, b, weightOfB) {
		return a + (b - a) * weightOfB;
	}
}

customElements.define('d2l-labs-media-player-audio-bars', MediaPlayerAudioBars);
