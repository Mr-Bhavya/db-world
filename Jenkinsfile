pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 60, unit: 'MINUTES')
        ansiColor('xterm')
    }

    tools {
        nodejs 'node20'
        maven  'maven3'
    }

    // ──────────────────────────────────────────────────────────────────────
    // PARAMETERS
    // ──────────────────────────────────────────────────────────────────────
    parameters {
        gitParameter(
            name: 'BRANCH',
            type: 'PT_BRANCH',
            defaultValue: 'master',
            description: 'Git branch to build',
            branchFilter: 'origin/(.*)',
            sortMode: 'DESCENDING',
            selectedValue: 'DEFAULT',
            quickFilterEnabled: true,
            useRepository: 'https://github.com/Mr-Bhavya/db-world.git',
        )
        choice(
            name: 'BUILD_TYPE',
            choices: ['full', 'frontend', 'backend'],
            description: 'Which part to build and deploy'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: true,
            description: 'Skip backend Maven tests'
        )
        booleanParam(
            name: 'SKIP_DEPLOY',
            defaultValue: false,
            description: 'Build only — skip all deployment steps'
        )
    }

    // ──────────────────────────────────────────────────────────────────────
    // ENVIRONMENT
    // ──────────────────────────────────────────────────────────────────────
    environment {
        FRONTEND_DIR          = 'db-world-frontend'
        BACKEND_DIR           = 'db-world-backend'

        FRONTEND_RELEASES_DIR = '/var/www/dbworld/releases'
        FRONTEND_CURRENT_LINK = '/var/www/dbworld/current'

        BACKEND_WAR_STAGE_DIR = '/app/db_world/war'
        BACKEND_WAR_NAME      = 'db-world.war'

        RUNTIME_ENV_DIR       = '/etc/dbworld'
        NPM_CACHE_DIR         = '/var/cache/jenkins/npm'

        MAVEN_OPTS            = '-Xms256m -Xmx512m -XX:+UseSerialGC -Dmaven.repo.local=/var/cache/jenkins/maven'
        // NOTE: Jasypt password and other runtime secrets live in the server's
        // env file sourced by dbworldctl — they are not needed at build time.
    }

    // ──────────────────────────────────────────────────────────────────────
    // STAGES
    // ──────────────────────────────────────────────────────────────────────
    stages {

        // ==================================================================
        // INIT — stamp the build and print parameters
        // ==================================================================
        stage('Initialize') {
            steps {
                script {
                    env.RELEASE_TAG = sh(script: 'date +%Y%m%d-%H%M%S', returnStdout: true).trim()
                    echo '\033[1;36m==========================================\033[0m'
                    echo '\033[1;36m  DB-WORLD PIPELINE                       \033[0m'
                    echo '\033[1;36m==========================================\033[0m'
                    echo "\033[33m▶ Release : ${env.RELEASE_TAG}\033[0m"
                    echo "\033[33m▶ Branch  : ${params.BRANCH}\033[0m"
                    echo "\033[33m▶ Type    : ${params.BUILD_TYPE}\033[0m"
                    echo "\033[33m▶ Tests   : ${params.SKIP_TESTS ? 'skipped' : 'enabled'}\033[0m"
                    echo "\033[33m▶ Deploy  : ${params.SKIP_DEPLOY ? 'skipped' : 'enabled'}\033[0m"
                    echo '\033[1;36m==========================================\033[0m'
                }
            }
        }

        // ==================================================================
        // CHECKOUT — shallow clone of selected branch
        // ==================================================================
        stage('Checkout') {
            steps {
                echo "\033[34m▶ Checking out '${params.BRANCH}' ...\033[0m"
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.BRANCH}"]],
                    userRemoteConfigs: [[
                        url: 'https://github.com/Mr-Bhavya/db-world.git',
                        credentialsId: 'Github_Mr-Bhavya'
                    ]],
                    extensions: [
                        [$class: 'CloneOption', depth: 1, shallow: true, noTags: true]
                    ]
                ])
                echo '\033[32m✔ Checkout done.\033[0m'
            }
        }

        // ==================================================================
        // BUILD — frontend and backend run in parallel for 'full' builds,
        //         saving roughly half the build time on RPi5.
        // ==================================================================
        stage('Build') {
            steps {
                script {
                    def buildTasks = [failFast: true]

                    if (params.BUILD_TYPE in ['frontend', 'full']) {
                        buildTasks['Frontend'] = {
                            stage('Frontend Build') {
                                echo '\033[34m▶ Building frontend ...\033[0m'
                                dir("${FRONTEND_DIR}") {
                                    sh '''
                                        set -ex

                                        if [ ! -f "${RUNTIME_ENV_DIR}/.env.production" ]; then
                                            echo "ERROR: ${RUNTIME_ENV_DIR}/.env.production not found"
                                            exit 1
                                        fi
                                        mkdir -p ../runtime
                                        cp "${RUNTIME_ENV_DIR}/.env.production" ../runtime/.env.production

                                        # npm ci is preferred — uses package-lock.json for reproducible installs
                                        if [ -f package-lock.json ]; then
                                            npm ci --cache "${NPM_CACHE_DIR}"
                                        else
                                            npm install --cache "${NPM_CACHE_DIR}"
                                        fi

                                        NODE_OPTIONS="--max-old-space-size=2048" npm run build:production
                                        echo "dist/ size: $(du -sh dist/ | cut -f1)"
                                    '''
                                }
                                echo '\033[32m✔ Frontend build done.\033[0m'
                            }
                        }
                    }

                    if (params.BUILD_TYPE in ['backend', 'full']) {
                        buildTasks['Backend'] = {
                            stage('Backend Build') {
                                echo '\033[34m▶ Building backend ...\033[0m'
                                dir("${BACKEND_DIR}") {
                                    sh '''
                                        set -ex
                                        mvn clean package \
                                            --batch-mode \
                                            --no-transfer-progress \
                                            -P prod \
                                            -DskipTests=${SKIP_TESTS}
                                    '''
                                }
                                echo '\033[32m✔ Backend build done.\033[0m'
                            }
                        }
                    }

                    parallel buildTasks
                }
            }
        }

        // ==================================================================
        // DEPLOY — skipped entirely when SKIP_DEPLOY=true.
        //          Frontend and backend deploy run in parallel.
        // ==================================================================
        stage('Deploy') {
            when {
                expression { !params.SKIP_DEPLOY }
            }
            steps {
                script {
                    def deployTasks = [failFast: true]

                    if (params.BUILD_TYPE in ['frontend', 'full']) {
                        deployTasks['Frontend'] = {
                            stage('Frontend Deploy') {
                                echo '\033[34m▶ Deploying frontend ...\033[0m'
                                sh '''
                                    set -ex
                                    RELEASE_DIR="${FRONTEND_RELEASES_DIR}/${RELEASE_TAG}"
                                    mkdir -p "$RELEASE_DIR"
                                    cp -r db-world-frontend/dist/* "$RELEASE_DIR/"
                                    ln -sfn "$RELEASE_DIR" "${FRONTEND_CURRENT_LINK}"
                                    # Keep only the last 5 releases
                                    ls -dt ${FRONTEND_RELEASES_DIR}/* | tail -n +6 | xargs rm -rf || true
                                    echo "Deployed to: $RELEASE_DIR"
                                '''
                                echo '\033[32m✔ Frontend deploy done.\033[0m'
                            }
                        }
                    }

                    if (params.BUILD_TYPE in ['backend', 'full']) {
                        deployTasks['Backend'] = {
                            stage('Backend Deploy') {
                                echo '\033[34m▶ Deploying backend ...\033[0m'
                                sh '''
                                    set -ex
                                    mkdir -p "${BACKEND_WAR_STAGE_DIR}"
                                    cp db-world-backend/${BACKEND_WAR_NAME} \
                                       ${BACKEND_WAR_STAGE_DIR}/${BACKEND_WAR_NAME}
                                    # dbworldctl sources the server env file, starts the service,
                                    # and performs its own health check — non-zero exit fails this stage.
                                    sudo /usr/local/bin/dbworldctl update \
                                        ${BACKEND_WAR_STAGE_DIR}/${BACKEND_WAR_NAME}
                                '''
                                echo '\033[32m✔ Backend deploy done.\033[0m'
                            }
                        }
                    }

                    parallel deployTasks
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // POST
    // ──────────────────────────────────────────────────────────────────────
    post {
        always {
            cleanWs()
            echo '\033[36m▶ Workspace cleaned.\033[0m'
        }
        success {
            echo '\033[1;32m==========================================\033[0m'
            echo "\033[1;32m  ✔ SUCCESS — release ${env.RELEASE_TAG}\033[0m"
            echo '\033[1;32m==========================================\033[0m'
        }
        failure {
            echo '\033[1;31m==========================================\033[0m'
            echo '\033[1;31m  ✘ FAILED — check stage logs above       \033[0m'
            echo '\033[1;31m==========================================\033[0m'
        }
    }
}
