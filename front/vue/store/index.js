import Vue from "vue";
import Vuex, { Store } from "vuex";
import FloatingVue from "floating-vue";
import alerts from "./modules/alerts";
import characters from "./modules/characters";
import filter from "./modules/filter";
import forms from "./modules/forms";
import ontology from "./modules/ontology";
import project from "./modules/project";
import projects from "./modules/projects";
import sidebar from "./modules/sidebar";
import user from "./modules/user";
import "floating-vue/dist/style.css";

Vue.use(Vuex);

Vue.use(FloatingVue, {
    themes: {
        "tags-dropdown": {
            $extend: "dropdown",
        },
        "vertical-menu": {
            $extend: "menu",
        },
    },
});

export default new Store({
    strict: process.env.NODE_ENV !== "production",
    modules: {
        alerts,
        characters,
        filter,
        forms,
        ontology,
        project,
        projects,
        sidebar,
        user,
    },
});
