var gulp = require("gulp"),
    rimraf = require('rimraf'),
    newer = require('gulp-newer'),
    babel = require("gulp-babel"),
    webpack = require('webpack-stream'),
    sourcemaps = require('gulp-sourcemaps'),
    less = require('gulp-less'),
    minifyCss = require('gulp-minify-css'),
    imagemin = require('gulp-imagemin'),
    pngquant = require('imagemin-pngquant'),
    browserSync = require("browser-sync"),
    watch = require('gulp-watch'),
    reload = browserSync.reload,
    livereload = require('gulp-livereload');

const NODE_ENV = process.env.NODE_ENV || 'development';

var path = {
    build: { //куда складывать готовые после сборки файлы
        js: './dst/scripts/',
        style: './dst/styles/',
        img: './dst/images/',
        fonts: './dst/fonts/'
    },
    src: { //Пути откуда брать исходники
        js: './src/Scripts/**/*.js',
        style: './src/Styles/**/*.*',
        img: './src/Images/**/*.*',
        fonts: './src/Fonts/**/*.*'
    },
    watch: { //за изменением каких файлов мы хотим наблюдать
        js: './src/Scripts/**/*.*',
        style: './src/Styles/**/*.*',
        img: './src/Images/**/*.*',
        fonts: './src/Fonts/**/*.*'
    },
    clean: './dst/',
    servDir: './dst'
};


//переменная с настройками нашего dev сервера:
var config = {
/*    server: {
        baseDir: path.servDir
    },*/
   // tunnel: false,
  //  host: 'localhost',
    port: 2016,
    proxy: "localhost:25921",
    logPrefix: "WSG_gulp_log"
};

gulp.task('livereload', function () {
    // Change the filepath, when you want to live reload a different page in your project.
  //  livereload.reload("./index.html");
});

gulp.task('js:build', function () {
    gulp.src(path.src.jsVendor)
        .pipe(gulp.dest(path.build.js + "Vendor/"));
    return gulp.src(path.src.js)
              .pipe(newer(path.build.js))
         //     .pipe(sourcemaps.init())
    //  .pipe(webpack(require('./webpack.config.js')))
        .pipe(webpack({
            context: __dirname + '/src',

            entry: {
                main: "./Scripts/main",
                register: "./Scripts/register.js",
                cabinet: "./Scripts/cabinet",
                businessTravel: "./Scripts/businessTravel.js",
                congress: "./Scripts/congress.js",
                services: "./Scripts/services.js",
                loyalty: "./Scripts/loyalty.js",
                payment: "./Scripts/payment.js"
            },

            output: {
                path: __dirname + '/dst',
                filename: "[name].js",
                library: "[name]"
            },

            devtool: NODE_ENV === 'development' ? "eval" : null,

       /*     plugins: [                        //поки не працює - треба встановити плагіни в npm
                new webpack.NoErrorsPlugin(),
                new webpack.optimize.CommonsChunkPlugin({
                    name: "common",
                    minChunks: 2
                })
            ],
            */
            module: {
                loaders: [
                    {
                        test: /\.js$/,
                        loaders: ["babel?presets[]=es2015"]
                    }, {
                        test: /\.css$/, loader: "style!css"
                    }, {
                        test: /\.(cshtml|png|jpg|svg|ttf|eot|woff|woff2)$/,
                        loader: 'file?name=[path][name].[ext]'
                    }
               ]
           }
        }))
    //  .pipe(sourcemaps.write("."))
      .pipe(gulp.dest(path.build.js))
      .pipe(reload({ stream: true }));
    /*
  .pipe(gulp.dest('dist/'));
    browserify(path.src.js, { debug: true })
        .transform(babelify
            .configure({
                sourceMapRelative: "./app/js",
                presets: ["es2015"]
            })
        )
        .bundle()
        .pipe(sourse('all.js'))
        .pipe(gulp.dest(path.build.js))
        .pipe(reload({ stream: true }));
        */
});

gulp.task('style:build', function () {
    gulp.src(path.src.styleVendor)
        .pipe(gulp.dest(path.build.style + "Vendor/"));

    return gulp.src(path.src.style)
        .pipe(newer(path.build.style))
        .pipe(sourcemaps.init()) 
   //     .pipe(less()) 
   //     .pipe(prefixer()) 			//Добавим вендорные префиксы
        .pipe(minifyCss()) 		    //Сожмем
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(path.build.style))
        .pipe(reload({ stream: true }));
});

gulp.task('image:build', function () {
    gulp.src(path.src.img) 				//Выберем наши картинки
        .pipe(newer(path.build.img))
     /*   .pipe(imagemin({ 				//Сожмем их
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()],
            interlaced: true
        }))*/
        .pipe(gulp.dest(path.build.img)) 
        .pipe(reload({stream: true}));
});
 
gulp.task('fonts:build', function () {
    gulp.src(path.src.fonts)
        .pipe(newer(path.build.fonts))
        .pipe(gulp.dest(path.build.fonts))
        .pipe(reload({ stream: true }));
});

//clean
gulp.task('clean', function (cb) {
    rimraf(path.clean, cb);
});

gulp.task('build', [
    'js:build',
    'style:build',
    'fonts:build',
    'image:build'
]);

gulp.task('watch', function () {
    watch([path.watch.style], function (event, cb) {
        gulp.start('style:build');
    });
    watch([path.watch.js], function (event, cb) {
        gulp.start('js:build');
    });
    watch([path.watch.img], function (event, cb) {
        gulp.start('image:build');
    });
    watch([path.watch.fonts], function (event, cb) {
        gulp.start('fonts:build');
    });
});

gulp.task('webserver', function () {
    browserSync(config);
});

gulp.task('default', ['build', 'webserver', 'watch']);

