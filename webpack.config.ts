import * as path from 'path';
import * as webpack from 'webpack';
import chokidar from 'chokidar'
import * as fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';


const PORT = 9000;
const SRC_DIR = 'src'
const ENTRY_DIR = "src/entries";
const DIST_DIR = 'dist';
const RES_DIR = 'res';
const PROXY = null;

const dist_dir = path.isAbsolute(DIST_DIR) ? DIST_DIR : path.resolve(__dirname, DIST_DIR);
const res_dir = path.resolve(__dirname, RES_DIR);
const entry_dir = path.resolve(__dirname, ENTRY_DIR);
const src_dir = path.resolve(__dirname, SRC_DIR);


//get possible entries by fetching folder names
let entries = fs.readdirSync(entry_dir).filter(s => !fs.statSync(path.resolve(entry_dir , s)).isFile()).map(s => path.basename(s));

// map html-entry pairs
let output_entries: {[key:string]:string} = {}
let multipleHtmlPlugins: HtmlWebpackPlugin[] = [];

for (let i = 0; i < entries.length; i++) {
  const name = entries[i];
  var current_dir = path.resolve(entry_dir, name)
  var chunkname = name + ".html"

  let template_path = path.resolve(current_dir, replaceExt(name, '.html'))
  let entry_path = path.resolve(current_dir, replaceExt(name, ".ts"));

  // create entry file if it does not exist in file system
  if (!fs.existsSync(entry_path)) 
    fs.closeSync(fs.openSync(entry_path, 'w'));
  
  output_entries[chunkname] = entry_path;

  // if html file exist use file as a template
  if (fs.existsSync(template_path)) {
    multipleHtmlPlugins.push(new HtmlWebpackPlugin({
      template: template_path,  
      filename: replaceExt(name, '.html'), //output file name 
      chunks: [`${chunkname}`],  
    }))
  } else {
    multipleHtmlPlugins.push(new HtmlWebpackPlugin({
      filename: replaceExt(name, '.html'),  // output file name
      chunks: [`${chunkname}`],  
    }))
  }
}
export default (env: any, argv: any) => {
  var isDev = argv.mode === 'development';
  var config: webpack.Configuration = {
    entry: output_entries,
    output: {
      path: dist_dir
    },
    resolve: {
      extensions: ['.ts', 'scss', '.css', '.js', '.json']
    },
    module:
    {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: [/node_modules/],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          use: 'file-loader',
        },
        {
          test: /\.(scss|css)$/, use: [
            { loader: MiniCssExtractPlugin.loader, options: { publicPath: '' } }, // to extract extract css from entry point
            { loader: "css-loader", options: { modules: false, sourceMap: isDev } },  // to convert the resulting CSS to Javascript to be bundled (modules:true to rename CSS classes in output to cryptic identifiers, except if wrapped in a :global(...) pseudo class)
            { loader: "css-modules-typescript-loader" },  // to generate a .d.ts module next to the .scss file (also requires a declaration.d.ts with "declare modules '*.scss';" in it to tell TypeScript that "import styles from './styles.scss';" means to load the module "./styles.scss.d.td")
            { loader: "sass-loader", options: { sourceMap: isDev } },  // to convert SASS to CSS
          ]
        },
      ]
    },
    devServer:
    {
      hot: true,
      port: PORT,
      proxy: PROXY ?? undefined, // {"**":"url"}
      before: function (app, server, compiler) {
        if (isDev) {
            chokidar.watch([path.resolve(src_dir, "**", "*.html")]).on('all', function (ev) {
            server.sockWrite(server.sockets, 'content-changed');
          })
        }
      }
    },
    plugins: [
      ...multipleHtmlPlugins,
      new MiniCssExtractPlugin({
        filename: '[name].css', 
        chunkFilename: '[id].css'
      }),
    ]
  };

  if (!isDev) {
    config.plugins?.push(new CopyWebpackPlugin({
      patterns: [
        { from: res_dir, to: path.resolve(dist_dir, RES_DIR) },
      ]
    }))
    console.log("building output " + dist_dir)
  }

  return config
}

function replaceExt(str: string, ext: string) {
  return str.replace(/(\.[^.]+$)|$/, ext);
}


