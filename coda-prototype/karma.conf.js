// Karma configuration
// Generated on Wed Sep 27 2017 10:51:32 GMT+0100 (GMT Summer Time)

module.exports = function(config) {
    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: "",

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ["jasmine"],

        // list of files / patterns to load in the browser
        files: [
            "external/papaparse/papaparse.js",
            "external/jquery/jquery-3.1.1.min.js",
            {
                pattern: "test/*.json",
                served: true,
                included: false
            },
            "src/ui/UIUtils.js",
            "dist/src/model.js",
            "dist/src/io/FileUtils.js",
            "dist/test/*.test.js"
        ],

        proxies: {
            "/test/": "/base/test/"
        },

        // list of files to exclude
        exclude: [],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            "dist/src/**/*.js": ["coverage"],
            "src/**/*.js": ["coverage"]
        },

        plugins: ["karma-coverage", "karma-jasmine", "karma-chrome-launcher"],

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ["progress", "coverage"],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: true,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ["Chrome"],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: false,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity
    });
};
