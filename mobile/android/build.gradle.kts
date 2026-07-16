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
// The override must run AFTER each plugin's own build script (file_picker sets
// compileSdk 34 in its body — plugins.withId fired too early and 34 won). Some
// projects are already evaluated here because of evaluationDependsOn(":app"),
// where afterEvaluate throws — so branch on the evaluation state.
subprojects {
    val forceSdk: (Project) -> Unit = { p ->
        p.extensions.findByType(com.android.build.gradle.BaseExtension::class.java)
            ?.compileSdkVersion(36)
    }
    if (state.executed) forceSdk(this) else afterEvaluate { forceSdk(this) }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
