module.exports = {
    plugins: {
        "@fullhuman/postcss-purgecss": {
            content: ["./content/**/*.html", "./content/**/*.md"],
            safelist: {
                greedy: ["/.animate.*/"]
            },
            // fontFace: false,
            variables: false
        },
        autoprefixer: {},
        cssnano: {
            preset: [
                "default",
                { "discardComments": { "removeAll": true } }
            ]
        }

        //cssnano: { preset: 'default' }
    }
};