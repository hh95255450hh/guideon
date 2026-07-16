allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Force every plugin module to compile against SDK 36. Plugins pin their own
// compileSdk (file_picker ships with 34), but flutter_plugin_android_lifecycle
// requires consumers to compile against 36 — checkReleaseAarMetadata fails the
// release build otherwise. Overriding here fixes all current & future plugins.
// (plugins.withId fires immediately if the plugin is already applied, so it is
// safe even though evaluationDependsOn(":app") pre-evaluates the subprojects —
// afterEvaluate blows up there with "project is already evaluated".)
subprojects {
    plugins.withId("com.android.library") {
        extensions.findByType(com.android.build.gradle.BaseExtension::class.java)
            ?.compileSdkVersion(36)
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
