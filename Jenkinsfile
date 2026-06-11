// DB World — Android release pipeline.
//
// Builds a signed release APK and publishes it (+ version.json) to the backend's
// release directory, which the in-app updater reads via GET /api/app/version.
//
// Agent requirements:
//   - Node + npm, Android SDK (ANDROID_HOME), JDK 17
//   - db-world-frontend/android/keystore.properties present on the agent
//     (gitignored — provision via Jenkins credentials / a config file), so
//     assembleRelease signs with the real key. Without it Gradle falls back to
//     debug signing and the build CANNOT update an installed release app.
//
// versionCode is the Jenkins BUILD_NUMBER (monotonic). versionName / mandatory /
// changelog are build parameters.

pipeline {
  agent any

  parameters {
    string(name: 'VERSION_NAME',        defaultValue: '1.0', description: 'Human version shown to users, e.g. 1.4.0')
    booleanParam(name: 'MANDATORY',     defaultValue: false, description: 'Force every user to update before using the app')
    string(name: 'MIN_SUPPORTED_CODE',  defaultValue: '0',   description: 'Force-update any installed versionCode below this floor')
    text(name: 'CHANGELOG',             defaultValue: '',    description: 'Release notes shown in the update dialog')
  }

  environment {
    FE          = 'db-world-frontend'
    // Directory the backend serves from (app.release-dir). If Jenkins runs on a
    // DIFFERENT host than the backend, see the scp alternative in the Publish stage.
    RELEASE_DIR = '/opt/dbworld/releases'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build web') {
      steps { dir(env.FE) { sh 'npm ci && npm run build' } }
    }

    stage('Capacitor sync') {
      steps { dir(env.FE) { sh 'npx cap sync android' } }
    }

    stage('Build signed APK') {
      steps {
        dir("${env.FE}/android") {
          sh """
            ./gradlew --no-daemon clean assembleRelease \
              -PappVersionCode=${env.BUILD_NUMBER} \
              -PappVersionName=${params.VERSION_NAME}
          """
        }
      }
    }

    stage('Publish') {
      steps {
        script {
          def apk = "${env.FE}/android/app/build/outputs/apk/release/app-release.apk"
          if (!fileExists(apk)) { error "APK not found at ${apk}" }

          // Metadata the in-app updater reads.
          writeFile file: 'version.json', text: groovy.json.JsonOutput.prettyPrint(
            groovy.json.JsonOutput.toJson([
              versionCode     : env.BUILD_NUMBER.toInteger(),
              versionName     : params.VERSION_NAME,
              mandatory       : params.MANDATORY,
              minSupportedCode: params.MIN_SUPPORTED_CODE.toInteger(),
              changelog       : params.CHANGELOG
            ])
          )

          // Same-host publish: copy via temp+mv so the app never sees a
          // version.json pointing at an APK that isn't in place yet.
          sh """
            mkdir -p '${RELEASE_DIR}'
            cp '${apk}' '${RELEASE_DIR}/app-release.apk.tmp'
            mv -f '${RELEASE_DIR}/app-release.apk.tmp' '${RELEASE_DIR}/app-release.apk'
            cp version.json '${RELEASE_DIR}/version.json.tmp'
            mv -f '${RELEASE_DIR}/version.json.tmp' '${RELEASE_DIR}/version.json'
          """

          // Different-host publish (backend on another server): replace the
          // block above with an scp/rsync push, e.g.
          //   sshagent(['dbworld-backend-ssh']) {
          //     sh "scp '${apk}' deploy@api.db-world.in:${RELEASE_DIR}/app-release.apk.tmp"
          //     sh "ssh deploy@api.db-world.in 'mv -f ${RELEASE_DIR}/app-release.apk.tmp ${RELEASE_DIR}/app-release.apk'"
          //     sh "scp version.json deploy@api.db-world.in:${RELEASE_DIR}/version.json"
          //   }

          archiveArtifacts artifacts: apk, fingerprint: true
        }
      }
    }
  }

  post {
    success { echo "Published versionCode=${env.BUILD_NUMBER} (${params.VERSION_NAME}); mandatory=${params.MANDATORY}" }
    failure { echo 'Release build failed — nothing published.' }
  }
}
