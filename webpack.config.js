const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    entry: {
        main: './main.ts',
        'service-worker': './service-worker.ts'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'index.html'
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'public', to: '' }
            ]
        })
    ],
    devtool: 'source-map',
    devServer: {
        allowedHosts: 'all',
    }
};
