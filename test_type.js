"use strict";
var awbs = [""];
var cleanedAwbs = awbs.map(function (a) { return a.trim(); }).filter(function (a) { return a !== ""; });
var uniqueAwbs = Array.from(new Set(cleanedAwbs));
var existingAwbs = new Set();
var newAwbsToSave = uniqueAwbs.filter(function (awb) { return !existingAwbs.has(awb); });
