const URL = window.URL || window.webkitURL;

export default async (url, name='download') => {
	const res = await fetch(url);
	const blob = await res.blob();
	const blobUrl = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.download = name;
	link.href = blob;
	link.click();
};
