/* eslint-disable import/first */
/**
 * Base webpack config used across other specific configs
 */

require("@babel/register");

const path = require("path");
const webpack = require("webpack");
const packageFile = require("./app/package.json");

module.exports = {
  externals: Object.keys(packageFile.dependencies || {}),

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            cacheDirectory: true
          }
        }
      }
    ]
  },

  output: {
    path: path.join(__dirname, "app"),
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: "commonjs2"
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: [".js", ".jsx", ".json"],
    modules: [path.join(__dirname, "app"), "node_modules"]
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: "production"
    })
  ]
};
