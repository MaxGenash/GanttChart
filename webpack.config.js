var webpack = require('webpack');

module.exports = {
    entry: "./public/js/main.js",
    output: {
        path: __dirname + '/public/js/',
        filename: "bundle.js"
    },
    watch: true,
    watchOptions: {
        aggregateTimeout: 100
    },
    devtool: "eval-source-map",
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: "babel?presets[]=es2015",
                exclude: [/node_modules/, /public/]
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            'fetch': 'imports?this=>global!exports?global.fetch!whatwg-fetch'
        })
    ]
};